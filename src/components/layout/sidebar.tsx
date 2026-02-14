"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import {
  Home,
  ClipboardList,
  User,
  Crown,
  LogOut,
  Menu,
  X,
  Shield,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const ADMIN_UUID = "c0023a5b-e4e9-4955-9ec7-2f9eed20db5a";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/quizzes", label: "My Exams", icon: ClipboardList },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/captains-club", label: "Captain's Club", icon: Crown },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut, profile } = useAuth();
  const isAdmin = user?.id === ADMIN_UUID;
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg" />
            <Image
              src="/assets/logo.png"
              alt="Groundschool AI"
              width={40}
              height={40}
              className="relative rounded-xl"
            />
          </div>
          <div>
            <span className="text-lg font-bold">Groundschool AI</span>
            <p className="text-xs text-muted-foreground">Aviation Exam Prep</p>
          </div>
        </Link>
      </div>

      {profile && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
              {(profile.full_name || profile.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile.full_name || "Pilot"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile.plan === "captains_club" ? "Captain's Club" : "Basic Plan"}
              </p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 space-y-1">
        {navItems.concat(
          isAdmin
            ? [{ href: "/admin", label: "Admin", icon: Shield }]
            : []
        ).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                isActive ? "bg-white/20" : "bg-muted/50 group-hover:bg-muted"
              )}>
                <item.icon className="h-4 w-4" />
              </div>
              {item.label}
              {item.label === "Captain's Club" && profile?.plan === "captains_club" && (
                <span className={cn(
                  "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full",
                  isActive ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-500"
                )}>
                  PRO
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
          onClick={async () => {
            await signOut();
            setMobileOpen(false);
            router.push("/login");
          }}
        >
          <div className="p-1.5 rounded-lg bg-muted/50">
            <LogOut className="h-4 w-4" />
          </div>
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/assets/logo.png"
            alt="Groundschool AI"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span className="font-bold">Groundschool AI</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-40 h-full w-64 bg-card border-r border-border transform transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-card to-background border-r border-border/50">
        <NavContent />
      </aside>
    </>
  );
}
