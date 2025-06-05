// Usage tracking service for subscription tier management
import { db } from './db';
import { usageMetrics, users, contacts, territories, schedules } from '@shared/schema';
import { eq, and, gte, lte, count, sum } from 'drizzle-orm';

// Subscription tier limits
const TIER_LIMITS = {
  free: {
    contacts: 50,
    territories: 1,
    schedules_per_month: 10,
    api_requests_per_day: 100,
    team_members: 1
  },
  pro: {
    contacts: 1000,
    territories: 10,
    schedules_per_month: 100,
    api_requests_per_day: 1000,
    team_members: 1
  },
  admin: {
    contacts: -1, // unlimited
    territories: -1, // unlimited
    schedules_per_month: -1, // unlimited
    api_requests_per_day: -1, // unlimited
    team_members: -1 // unlimited
  }
};

export interface UsageStats {
  contacts: number;
  territories: number;
  schedulesThisMonth: number;
  apiRequestsToday: number;
  limits: typeof TIER_LIMITS.free;
  canCreateContact: boolean;
  canCreateTerritory: boolean;
  canCreateSchedule: boolean;
}

// Get current usage for a user
export async function getUserUsage(userId: number): Promise<UsageStats> {
  try {
    // Get user's subscription tier
    const userResult = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      throw new Error('User not found');
    }

    const userRole = userResult[0].role as keyof typeof TIER_LIMITS;
    const limits = TIER_LIMITS[userRole] || TIER_LIMITS.free;

    // Count contacts
    const contactCount = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.userId, userId));

    // Count territories
    const territoryCount = await db
      .select({ count: count() })
      .from(territories)
      .where(eq(territories.userId, userId));

    // Count schedules this month
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const scheduleCount = await db
      .select({ count: count() })
      .from(schedules)
      .where(
        and(
          eq(schedules.userId, userId),
          gte(schedules.createdAt, currentMonth),
          lte(schedules.createdAt, nextMonth)
        )
      );

    // Get API requests today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const apiRequestsResult = await db
      .select({ total: sum(usageMetrics.metricValue) })
      .from(usageMetrics)
      .where(
        and(
          eq(usageMetrics.userId, userId),
          eq(usageMetrics.metricType, 'api_requests'),
          gte(usageMetrics.periodStart, today),
          lte(usageMetrics.periodEnd, tomorrow)
        )
      );

    const stats: UsageStats = {
      contacts: contactCount[0]?.count || 0,
      territories: territoryCount[0]?.count || 0,
      schedulesThisMonth: scheduleCount[0]?.count || 0,
      apiRequestsToday: apiRequestsResult[0]?.total || 0,
      limits,
      canCreateContact: limits.contacts === -1 || (contactCount[0]?.count || 0) < limits.contacts,
      canCreateTerritory: limits.territories === -1 || (territoryCount[0]?.count || 0) < limits.territories,
      canCreateSchedule: limits.schedules_per_month === -1 || (scheduleCount[0]?.count || 0) < limits.schedules_per_month,
    };

    return stats;
  } catch (error) {
    console.error('Usage tracking error:', error);
    throw error;
  }
}

// Record usage metric
export async function recordUsage(
  userId: number,
  metricType: 'contacts' | 'territories' | 'schedules' | 'api_requests',
  value: number = 1
): Promise<void> {
  try {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    // Set period based on metric type
    switch (metricType) {
      case 'api_requests':
        // Daily tracking
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 1);
        break;
      case 'schedules':
        // Monthly tracking
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      default:
        // Lifetime tracking
        periodStart = new Date(0);
        periodEnd = new Date('2099-12-31');
    }

    // Check if metric already exists for this period
    const existingMetric = await db
      .select()
      .from(usageMetrics)
      .where(
        and(
          eq(usageMetrics.userId, userId),
          eq(usageMetrics.metricType, metricType),
          eq(usageMetrics.periodStart, periodStart),
          eq(usageMetrics.periodEnd, periodEnd)
        )
      )
      .limit(1);

    if (existingMetric.length > 0) {
      // Update existing metric
      await db
        .update(usageMetrics)
        .set({
          metricValue: existingMetric[0].metricValue + value
        })
        .where(eq(usageMetrics.id, existingMetric[0].id));
    } else {
      // Create new metric
      await db
        .insert(usageMetrics)
        .values({
          userId,
          metricType,
          metricValue: value,
          periodStart,
          periodEnd
        });
    }
  } catch (error) {
    console.error('Record usage error:', error);
    throw error;
  }
}

// Check if user can perform action based on tier limits
export async function checkTierLimit(
  userId: number,
  action: 'create_contact' | 'create_territory' | 'create_schedule' | 'api_request'
): Promise<{ allowed: boolean; reason?: string; currentUsage?: number; limit?: number }> {
  try {
    const usage = await getUserUsage(userId);

    switch (action) {
      case 'create_contact':
        if (!usage.canCreateContact) {
          return {
            allowed: false,
            reason: `Contact limit reached. Your ${usage.limits === TIER_LIMITS.free ? 'free' : 'pro'} plan allows ${usage.limits.contacts} contacts.`,
            currentUsage: usage.contacts,
            limit: usage.limits.contacts
          };
        }
        break;
      case 'create_territory':
        if (!usage.canCreateTerritory) {
          return {
            allowed: false,
            reason: `Territory limit reached. Your ${usage.limits === TIER_LIMITS.free ? 'free' : 'pro'} plan allows ${usage.limits.territories} territories.`,
            currentUsage: usage.territories,
            limit: usage.limits.territories
          };
        }
        break;
      case 'create_schedule':
        if (!usage.canCreateSchedule) {
          return {
            allowed: false,
            reason: `Monthly schedule limit reached. Your ${usage.limits === TIER_LIMITS.free ? 'free' : 'pro'} plan allows ${usage.limits.schedules_per_month} schedules per month.`,
            currentUsage: usage.schedulesThisMonth,
            limit: usage.limits.schedules_per_month
          };
        }
        break;
      case 'api_request':
        if (usage.limits.api_requests_per_day !== -1 && usage.apiRequestsToday >= usage.limits.api_requests_per_day) {
          return {
            allowed: false,
            reason: `Daily API request limit reached. Your ${usage.limits === TIER_LIMITS.free ? 'free' : 'pro'} plan allows ${usage.limits.api_requests_per_day} requests per day.`,
            currentUsage: usage.apiRequestsToday,
            limit: usage.limits.api_requests_per_day
          };
        }
        break;
    }

    return { allowed: true };
  } catch (error) {
    console.error('Tier limit check error:', error);
    return { allowed: false, reason: 'Unable to verify tier limits' };
  }
}

// Middleware to check tier limits
export function createTierLimitMiddleware(action: Parameters<typeof checkTierLimit>[1]) {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const limitCheck = await checkTierLimit(userId, action);
      if (!limitCheck.allowed) {
        return res.status(403).json({
          message: limitCheck.reason,
          upgrade_required: true,
          current_usage: limitCheck.currentUsage,
          limit: limitCheck.limit
        });
      }

      // Record the usage if action is allowed
      if (action !== 'api_request') {
        const metricType = action.replace('create_', '') as 'contacts' | 'territories' | 'schedules';
        await recordUsage(userId, metricType);
      }

      next();
    } catch (error) {
      console.error('Tier limit middleware error:', error);
      return res.status(500).json({ message: 'Unable to verify tier limits' });
    }
  };
}

// Get usage statistics for dashboard
export async function getDashboardUsage(userId: number): Promise<any> {
  try {
    const usage = await getUserUsage(userId);
    const userResult = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const currentTier = userResult[0]?.role || 'free';

    return {
      current_tier: currentTier,
      usage: {
        contacts: {
          used: usage.contacts,
          limit: usage.limits.contacts,
          percentage: usage.limits.contacts === -1 ? 0 : Math.round((usage.contacts / usage.limits.contacts) * 100)
        },
        territories: {
          used: usage.territories,
          limit: usage.limits.territories,
          percentage: usage.limits.territories === -1 ? 0 : Math.round((usage.territories / usage.limits.territories) * 100)
        },
        schedules: {
          used: usage.schedulesThisMonth,
          limit: usage.limits.schedules_per_month,
          percentage: usage.limits.schedules_per_month === -1 ? 0 : Math.round((usage.schedulesThisMonth / usage.limits.schedules_per_month) * 100)
        },
        api_requests: {
          used: usage.apiRequestsToday,
          limit: usage.limits.api_requests_per_day,
          percentage: usage.limits.api_requests_per_day === -1 ? 0 : Math.round((usage.apiRequestsToday / usage.limits.api_requests_per_day) * 100)
        }
      },
      upgrade_available: currentTier === 'free'
    };
  } catch (error) {
    console.error('Dashboard usage error:', error);
    throw error;
  }
}