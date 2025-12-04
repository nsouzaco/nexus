import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Bot, Database, MessageSquare, Search, User, Lock, Shield, Key } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm fixed top-0 w-full z-50 bg-background/80">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-semibold">Nexus</span>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero & Visual Demo Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Hero Content */}
          <div className="text-left">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              AI-Powered Business Intelligence
            </div>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Ask anything about
              <br />
              your business data
            </h1>
            <p className="text-xl text-muted-foreground max-w-xl mb-10">
              Connect your tools, ask questions in plain English, and get instant answers with source citations. 
              No more searching through multiple apps.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="gap-2 text-base h-12 px-8">
                  Start for Free <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="text-base h-12 px-8">
                  See Features
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column: Visual Demo */}
          <div className="relative">
            <div className="relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur overflow-hidden shadow-2xl shadow-primary/5">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
              <div className="relative p-6 md:p-8">
                {/* Mock Chat Interface */}
                <div className="space-y-6">
                  {/* User message - aligned right */}
                  <div className="flex gap-3 justify-end">
                    <div className="rounded-2xl px-4 py-3 bg-primary text-primary-foreground max-w-[90%]">
                      <p className="text-sm">What were the key decisions from last week&apos;s product meeting?</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                  {/* Assistant message - aligned left */}
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-muted max-w-[90%]">
                      <p className="text-sm mb-3">Based on your Notion meeting notes from Nov 20th, here are the key decisions:</p>
                      <ul className="text-sm space-y-1 list-disc pl-4 text-muted-foreground">
                        <li>Launched v2.0 feature set approved for Q1</li>
                        <li>Mobile app development postponed to Q2</li>
                        <li>New pricing tier approved at $29/month</li>
                      </ul>
                      <div className="flex gap-2 mt-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background/50 text-xs text-muted-foreground border border-border/50">
                          <Database className="w-3 h-3" /> Notion: Product Meeting Notes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
            Connects to your stack
          </h2>
          <p className="text-muted-foreground text-lg mb-12">
            Seamlessly integrates with the tools you already use
          </p>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { name: "Notion", logo: "/assets/icons/notion.svg" },
              { name: "Google Drive", logo: "/assets/icons/google-drive.svg" },
              { name: "Airtable", logo: "/assets/icons/airtable.svg" },
              { name: "GitHub", logo: "/assets/icons/github.svg" },
            ].map((integration) => (
              <div
                key={integration.name}
                className="flex items-center gap-3 px-8 py-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur hover:bg-card/50 transition-all hover:scale-105"
              >
                <div className="relative w-8 h-8">
                  <Image
                    src={integration.logo}
                    alt={integration.name}
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="font-medium text-lg">{integration.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              All your tools, one conversation
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Connect your favorite apps and start asking questions immediately
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Database className="w-6 h-6" />}
              title="Connect Your Data"
              description="Link Notion, Google Drive, Airtable, GitHub and more. Your data stays secure and private."
            />
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6" />}
              title="Ask in Plain English"
              description="No complex queries needed. Just ask like you would ask a colleague."
            />
            <FeatureCard
              icon={<Search className="w-6 h-6" />}
              title="Cited Answers"
              description="Every answer includes links to the source documents so you can verify and dig deeper."
            />
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 px-6 bg-primary/5 border-y border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Enterprise-grade Security
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Your data security is our top priority. We use industry-standard encryption and security practices.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-4 text-primary">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Encryption at Rest</h3>
              <p className="text-muted-foreground">
                All your data is encrypted using AES-256 encryption before being stored in our database.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-4 text-primary">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Private by Design</h3>
              <p className="text-muted-foreground">
                We never train our AI models on your data. Your information remains yours and yours alone.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-4 text-primary">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Granular Access</h3>
              <p className="text-muted-foreground">
                Row-level security ensures data is strictly isolated between users and organizations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="rounded-3xl bg-background p-12 border border-primary/20 shadow-lg">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Ready to get started?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join thousands of teams making better decisions with AI-powered insights.
            </p>
            <Link href="/signup">
              <Button size="lg" className="gap-2 text-base h-12 px-8">
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30 pt-20 pb-10 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12 mb-16">
          <div className="space-y-4">
            <span className="text-xl font-semibold">Nexus</span>
            <p className="text-muted-foreground text-sm max-w-xs">
              Empowering teams with instant access to their collective knowledge through AI.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Integrations</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Security</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Enterprise</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Careers</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2024 Nexus Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-foreground transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-foreground transition-colors">GitHub</Link>
            <Link href="#" className="hover:text-foreground transition-colors">LinkedIn</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-6 rounded-2xl border border-border/50 bg-card/30 backdrop-blur hover:bg-card/50 transition-colors">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

