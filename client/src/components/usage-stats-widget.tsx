import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Zap, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface UsageData {
  current_tier: string;
  usage: {
    contacts: { used: number; limit: number; percentage: number };
    territories: { used: number; limit: number; percentage: number };
    schedules: { used: number; limit: number; percentage: number };
    api_requests: { used: number; limit: number; percentage: number };
  };
  upgrade_available: boolean;
}

export function UsageStatsWidget() {
  const { data: usageData, isLoading, error } = useQuery<UsageData>({
    queryKey: ['/api/usage/stats'],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Usage Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
                <div className="h-2 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Usage Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Failed to load usage statistics</p>
        </CardContent>
      </Card>
    );
  }

  if (!usageData) return null;

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'pro':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Users className="w-4 h-4 text-purple-500" />;
      default:
        return <Zap className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro':
        return 'bg-yellow-100 text-yellow-800';
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? 'Unlimited' : limit.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Usage Statistics</span>
          </CardTitle>
          <Badge className={getTierColor(usageData.current_tier)}>
            <div className="flex items-center space-x-1">
              {getTierIcon(usageData.current_tier)}
              <span className="capitalize">{usageData.current_tier} Plan</span>
            </div>
          </Badge>
        </div>
        <CardDescription>
          Track your usage across different features and services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {Object.entries(usageData.usage).map(([key, stats]) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium capitalize">
                  {key.replace('_', ' ')}
                </span>
                <span className="text-sm text-gray-500">
                  {stats.used.toLocaleString()} / {formatLimit(stats.limit)}
                </span>
              </div>
              <div className="relative">
                <Progress 
                  value={stats.percentage} 
                  className="h-2"
                />
                <div 
                  className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getProgressColor(stats.percentage)}`}
                  style={{ width: `${Math.min(stats.percentage, 100)}%` }}
                />
              </div>
              {stats.percentage >= 80 && stats.limit !== -1 && (
                <p className="text-xs text-orange-600">
                  {stats.percentage >= 90 ? 'Limit almost reached!' : 'Approaching limit'}
                </p>
              )}
            </div>
          ))}
        </div>

        {usageData.upgrade_available && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Upgrade to Pro</h4>
                <p className="text-xs text-gray-500">
                  Get higher limits and advanced features
                </p>
              </div>
              <Link href="/upgrade">
                <Button size="sm" className="ml-3">
                  <Crown className="w-4 h-4 mr-1" />
                  Upgrade
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 pt-2 border-t">
          <p>Usage resets monthly. API requests reset daily.</p>
        </div>
      </CardContent>
    </Card>
  );
}