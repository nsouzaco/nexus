import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Bot, Database, MessageSquare, Search, User, Zap } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm fixed top-0 w-full z-50 bg-background/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold">Adapt</span>
          </div>
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

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            AI-Powered Business Intelligence
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text">
            Ask anything about
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-pink-400">
              your business data
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Connect your tools, ask questions in plain English, and get instant answers with source citations. 
            No more searching through multiple apps.
          </p>
          <div className="flex items-center justify-center gap-4">
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
      </section>

      {/* Visual Demo */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur overflow-hidden shadow-2xl shadow-primary/5">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
            <div className="relative p-8">
              {/* Mock Chat Interface */}
              <div className="space-y-6 max-w-3xl mx-auto">
                {/* User message - aligned right */}
                <div className="flex gap-3 justify-end">
                  <div className="rounded-2xl px-4 py-3 bg-primary text-primary-foreground max-w-[85%]">
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
                  <div className="rounded-2xl px-4 py-3 bg-muted max-w-[85%]">
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
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
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

      {/* Integrations */}
      <section className="py-20 px-6 border-t border-border/40">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Connects to your stack
          </h2>
          <p className="text-muted-foreground text-lg mb-12">
            Seamlessly integrates with the tools you already use
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {["Notion", "Google Drive", "Airtable", "GitHub"].map((name) => (
              <div
                key={name}
                className="px-6 py-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur"
              >
                <span className="font-medium">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="rounded-3xl bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/20 p-12 border border-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
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
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span>Adapt Clone</span>
          </div>
          <p>© 2024 All rights reserved.</p>
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

