import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border shadow-sm overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
}

export function Button({ 
  className, 
  variant = "primary", 
  size = "md", 
  isLoading,
  children,
  disabled,
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive",
  size?: "sm" | "md" | "lg" | "icon",
  isLoading?: boolean
}) {
  const variants = {
    primary: "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-border bg-transparent hover:border-primary hover:text-primary",
    ghost: "bg-transparent hover:bg-muted text-foreground",
    destructive: "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 font-medium",
    lg: "px-6 py-3.5 text-lg font-semibold",
    icon: "p-2.5 flex items-center justify-center aspect-square"
  };

  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      className={cn(
        "w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground transition-all duration-200",
        "focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
}

export function Badge({ 
  children, 
  variant = "default",
  className
}: { 
  children: React.ReactNode, 
  variant?: "default" | "success" | "warning" | "error" | "neutral",
  className?: string
}) {
  const variants = {
    default: "bg-primary/10 text-primary border border-primary/20",
    success: "bg-emerald-50 text-emerald-600 border border-emerald-200",
    warning: "bg-amber-50 text-amber-600 border border-amber-200",
    error: "bg-rose-50 text-rose-600 border border-rose-200",
    neutral: "bg-slate-100 text-slate-600 border border-slate-200"
  };

  return (
    <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider", variants[variant], className)}>
      {children}
    </span>
  );
}

export function PageHeader({ title, description, action }: { title: string, description?: string, action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
      <p className="text-muted-foreground font-medium animate-pulse">Cargando datos...</p>
    </div>
  );
}

export function ErrorState({ message = "Ha ocurrido un error", retry }: { message?: string, retry?: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinelinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">Algo salió mal</h3>
      <p className="text-muted-foreground max-w-md mb-6">{message}</p>
      {retry && <Button onClick={retry} variant="outline">Intentar nuevamente</Button>}
    </div>
  );
}
