import { useAuth } from "@/hooks/use-auth";
import { PRO_FEATURES, UserRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Upgrade() {
  const { user, upgradeToPro, isUpgradePending } = useAuth();
  const { toast } = useToast();

  const handleUpgrade = () => {
    upgradeToPro();
    toast({
      title: "Success!",
      description: "Your account has been upgraded to Pro.",
    });
  };

  const isAlreadyPro = user?.role === UserRole.PRO || user?.role === UserRole.ADMIN;

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-neutral-800 mb-2">Upgrade Your DoorPro CRM Experience</h1>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Choose the plan that fits your needs and take your door-to-door sales to the next level
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <Card className={`border-2 ${user?.role === UserRole.FREE ? 'border-primary' : 'border-transparent'}`}>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Free</CardTitle>
              <CardDescription>Get started with the basics</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-neutral-500 ml-1">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Up to 50 contacts</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>1 territory</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Basic scheduling (10 schedules)</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Contact management</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Google Maps integration</span>
                </div>
                <div className="flex items-center">
                  <X className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-neutral-400">Advanced analytics</span>
                </div>
                <div className="flex items-center">
                  <X className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-neutral-400">Team management</span>
                </div>
                <div className="flex items-center">
                  <X className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-neutral-400">Automated follow-ups</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              {user?.role === UserRole.FREE ? (
                <Button disabled className="w-full">Current Plan</Button>
              ) : (
                <Button variant="outline" className="w-full">Downgrade</Button>
              )}
            </CardFooter>
          </Card>

          {/* Pro Plan */}
          <Card className={`border-2 ${isAlreadyPro ? 'border-primary' : 'border-transparent'} bg-gradient-to-b from-white to-blue-50`}>
            <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
              <Badge className="bg-primary text-white">RECOMMENDED</Badge>
            </div>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Pro</CardTitle>
              <CardDescription>Everything you need for success</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-neutral-500 ml-1">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span className="font-medium">Unlimited contacts</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span className="font-medium">Unlimited territories</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span className="font-medium">Unlimited schedules</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Advanced analytics & reporting</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Team management</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Automated follow-ups</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Data export capabilities</span>
                </div>
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Priority support</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              {isAlreadyPro ? (
                <Button disabled className="w-full">Current Plan</Button>
              ) : (
                <Button 
                  onClick={handleUpgrade} 
                  disabled={isUpgradePending}
                  className="w-full"
                >
                  {isUpgradePending ? "Upgrading..." : "Upgrade Now"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* Pro Features */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center mb-10">Pro Features</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {PRO_FEATURES.map((feature, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start">
                    <div className="bg-blue-100 p-3 rounded-full mr-4">
                      <span className="material-icons text-primary">{feature.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-lg mb-2">{feature.title}</h3>
                      <p className="text-neutral-600 text-sm">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">How does the free plan work?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600">
                  The free plan allows you to manage up to 50 contacts, create 1 territory, and schedule up to 10 appointments. 
                  It's perfect for individuals starting out with door-to-door sales.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Can I upgrade or downgrade at any time?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600">
                  Yes, you can upgrade to Pro at any time. If you downgrade from Pro to Free, you'll maintain access to all your data, 
                  but will be limited to the Free plan restrictions.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Is there a contract or commitment?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600">
                  No, DoorPro CRM is billed monthly with no long-term contracts. You can cancel at any time.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
