import Stripe from 'stripe';

// Check if Stripe Secret Key exists
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

// Initialize Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // Use latest API version or specify your version
});

// Price ID for the $25/month per team member subscription
// In a real app, you'd create a product and price in the Stripe dashboard
const TEAM_MEMBER_PRICE_ID = 'price_team_member_monthly';

export interface CustomerData {
  email: string;
  name: string;
  userId: number;
}

export interface SubscriptionData {
  customerId: string;
  priceId: string;
  quantity?: number;
  trialDays?: number;
}

/**
 * Creates or retrieves a Stripe customer
 */
export async function getOrCreateCustomer(data: CustomerData): Promise<string> {
  try {
    // First, check if a customer with this userId metadata already exists
    const customers = await stripe.customers.list({
      limit: 1,
      expand: ['data.subscriptions'],
      email: data.email,
    });

    if (customers.data.length > 0) {
      return customers.data[0].id;
    }

    // Create a new customer
    const customer = await stripe.customers.create({
      email: data.email,
      name: data.name,
      metadata: {
        userId: data.userId.toString(),
      },
    });

    return customer.id;
  } catch (error) {
    console.error('Error in getOrCreateCustomer:', error);
    throw error;
  }
}

/**
 * Creates a subscription for a customer
 */
export async function createSubscription(data: SubscriptionData): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: data.customerId,
      items: [
        {
          price: data.priceId,
          quantity: data.quantity || 1,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      trial_period_days: data.trialDays,
    });

    return subscription;
  } catch (error) {
    console.error('Error in createSubscription:', error);
    throw error;
  }
}

/**
 * Updates a subscription quantity
 */
export async function updateSubscriptionQuantity(
  subscriptionId: string,
  quantity: number
): Promise<Stripe.Subscription> {
  try {
    // Get the subscription to find the subscription item ID
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItemId = subscription.items.data[0].id;

    // Update the subscription
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscriptionItemId,
          quantity: quantity,
        },
      ],
    });

    return updatedSubscription;
  } catch (error) {
    console.error('Error in updateSubscriptionQuantity:', error);
    throw error;
  }
}

/**
 * Cancels a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('Error in cancelSubscription:', error);
    throw error;
  }
}

/**
 * Creates a checkout session for adding team members
 */
export async function createTeamMemberCheckoutSession(
  customerId: string,
  quantity: number = 1,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: TEAM_MEMBER_PRICE_ID,
          quantity: quantity,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session.url;
  } catch (error) {
    console.error('Error in createTeamMemberCheckoutSession:', error);
    throw error;
  }
}

/**
 * Creates a setup intent to save a payment method
 */
export async function createSetupIntent(customerId: string): Promise<string> {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    return setupIntent.client_secret;
  } catch (error) {
    console.error('Error in createSetupIntent:', error);
    throw error;
  }
}

/**
 * Validates a webhook signature and returns the event
 */
export function constructEventFromPayload(signature: string, payload: Buffer): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET. Set up webhook signing secret in environment variables.');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Handles subscription status updates from webhooks
 */
export async function handleSubscriptionStatusChange(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = subscription.customer as string;
  const status = subscription.status;

  console.log(`Subscription status for ${customerId} changed to ${status}`);
  
  // Update your database based on the subscription status
}