import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout";
import Login from "@/pages/Login";
import AcceptInvite from "@/pages/AcceptInvite";
import Dashboard from "@/pages/Dashboard";
import Conversations from "@/pages/Conversations";
import ConversationDetail from "@/pages/ConversationDetail";
import Products from "@/pages/Products";
import Settings from "@/pages/Settings";
import Crm from "@/pages/Crm";
import Catalogues from "@/pages/Catalogues";
import Automations from "@/pages/Automations";
import QuickResponses from "@/pages/QuickResponses";
import Team from "@/pages/Team";
import Templates from "@/pages/Templates";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthenticatedRouter() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const isPublic = location.startsWith("/login") || location.startsWith("/accept-invite");

  useEffect(() => {
    if (!isLoading && !user && !isPublic) {
      setLocation("/login");
    }
  }, [isLoading, user, isPublic, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (location.startsWith("/login")) return <Login />;
  if (location.startsWith("/accept-invite")) return <AcceptInvite />;
  if (!user) return null;

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/conversations/:id" component={ConversationDetail} />
        <Route path="/products" component={Products} />
        <Route path="/settings" component={Settings} />
        <Route path="/crm" component={Crm} />
        <Route path="/catalogues" component={Catalogues} />
        <Route path="/automations" component={Automations} />
        <Route path="/quick-responses" component={QuickResponses} />
        <Route path="/team" component={Team} />
        <Route path="/templates" component={Templates} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AuthenticatedRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
