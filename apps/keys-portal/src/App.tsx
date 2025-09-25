import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import Index from "./pages/Index";
import LockSystems from "./pages/LockSystems";
import LockSystemDetail from "./pages/LockSystemDetail";
import NotFound from "./pages/NotFound";
import { AuthCallback } from "./auth/AuthCallback";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import KeyLoan from "./pages/KeyLoan";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const AppContent = () => (
  <>
    <Navigation />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/lock-systems" element={<LockSystems />} />
      <Route path="/lock-systems/:id" element={<LockSystemDetail />} />
      <Route path="/utlaning" element={<KeyLoan />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/callback" element={<AuthCallback />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
