import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authApi, storeAuthData } from "@/lib/api";
import { useGoogleLogin } from "@react-oauth/google";


const LoginPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        const response = await authApi.socialLogin({
          provider: "google",
          token: tokenResponse.access_token,
        });
        storeAuthData(response);
        toast({
          title: "Logged in successfully!",
          description: `Welcome ${response.user.full_name || response.user.username}!`,
        });
        navigate("/");
      } catch (error: any) {
        const message = error?.response?.data?.detail || "Google authentication failed.";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      toast({
        title: "Google Sign-In Failed",
        description: "Could not authenticate with Google. Please try again.",
        variant: "destructive",
      });
    },
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const response = await authApi.login(formData.email, formData.password);
        storeAuthData(response);
        toast({
          title: "Welcome back!",
          description: `Logged in as ${response.user.username || response.user.email}`,
        });
      } else {
        const response = await authApi.register({
          username: formData.username || formData.email.split('@')[0],
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone,
        });
        storeAuthData(response);
        toast({
          title: "Account created!",
          description: "Welcome to CarMarket!",
        });
      }
      navigate("/");
    } catch (error: any) {
      const message = error?.response?.data?.detail || "Authentication failed. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Shared dark input styling (charcoal fill, gold focus ring).
  const inputCls =
    "h-12 rounded-xl border-neutral-700 bg-neutral-900/60 text-neutral-100 placeholder:text-neutral-500 " +
    "focus-visible:ring-2 focus-visible:ring-[#A87601]/60 focus-visible:border-[#A87601]/60 transition-colors";

  return (
    <div className="min-h-screen flex bg-[#0f0f11] text-neutral-100 selection:bg-[#A87601]/30">
      {/* ── Left · form panel (dark, refined) ─────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center px-6 py-10 lg:px-16">
        {/* faint radial glow + grain for atmosphere (no flat color) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 20% 0%, rgba(168,118,1,0.14), transparent 55%), radial-gradient(90% 60% at 90% 100%, rgba(168,118,1,0.06), transparent 60%)",
          }}
        />

        {/* Back to Home */}
        <Link
          to="/"
          className="absolute top-6 left-6 lg:left-16 z-10 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-400 transition-colors duration-200 hover:text-[#E0A82E]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="relative w-full max-w-sm">
          {/* Logo */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 mb-10 animate-fade-in opacity-0"
            style={{ animationDelay: "40ms", animationFillMode: "forwards" }}
          >
            <span className="font-poppins text-3xl font-bold tracking-tight text-neutral-50">
              Car<span className="text-[#E0A82E]">Market</span>
            </span>
          </Link>

          {/* Header */}
          <div
            className="mb-8 animate-fade-in opacity-0"
            style={{ animationDelay: "120ms", animationFillMode: "forwards" }}
          >
            <h1 className="font-poppins text-[2rem] leading-tight font-semibold text-neutral-50">
              {isLogin ? "Welcome back" : "Create account"}
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              {isLogin
                ? "Sign in to access your account"
                : "Start your journey with us today"}
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5 animate-fade-in opacity-0"
            style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
          >
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-xs font-medium uppercase tracking-wide text-neutral-400">Full Name</Label>
                <Input
                  id="full_name"
                  placeholder="John Doe"
                  required
                  className={inputCls}
                  value={formData.full_name}
                  onChange={handleInputChange}
                />
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-medium uppercase tracking-wide text-neutral-400">Username</Label>
                <Input
                  id="username"
                  placeholder="johndoe"
                  required
                  className={inputCls}
                  value={formData.username}
                  onChange={handleInputChange}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-neutral-400">{isLogin ? "Email or Username" : "Email"}</Label>
              <Input
                id="email"
                type={isLogin ? "text" : "email"}
                placeholder="you@example.com"
                required
                className={inputCls}
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-neutral-400">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  className={`${inputCls} pr-12`}
                  value={formData.password}
                  onChange={handleInputChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-[#E0A82E] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="text-right -mt-1">
                <a href="#" className="text-sm text-neutral-400 hover:text-[#E0A82E] transition-colors">
                  Forgot password?
                </a>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium uppercase tracking-wide text-neutral-400">Phone Number (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 555-0123"
                  className={inputCls}
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
            )}

            <Button
              type="submit"
              className="group w-full h-12 rounded-xl bg-[#A87601] text-white font-semibold text-base shadow-[0_8px_30px_-8px_rgba(168,118,1,0.7)] transition-all duration-200 hover:bg-[#c48c07] hover:shadow-[0_10px_36px_-6px_rgba(168,118,1,0.85)]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-7">
            <div className="h-px w-full bg-neutral-800" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f0f11] px-4 text-xs uppercase tracking-wider text-neutral-500">
              or continue with
            </span>
          </div>

          {/* Social Login */}
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 border-neutral-700 bg-neutral-900/50 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50 hover:border-neutral-600 transition-all duration-200"
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={isLoading}
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
            Continue with Google
          </Button>

          {/* Toggle */}
          <p className="mt-8 text-center text-sm text-neutral-400">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#E0A82E] font-semibold hover:underline underline-offset-4"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>

      {/* ── Right · cinematic image ───────────────────────────────────── */}
      <div className="hidden lg:block relative flex-1 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400&h=1800&fit=crop&q=85"
          alt="Luxury car"
          className="absolute inset-0 h-full w-full object-cover animate-fade-in opacity-0"
          style={{ animationDelay: "80ms", animationDuration: "900ms", animationFillMode: "forwards" }}
        />
        {/* Dark scrims: left edge melts into the charcoal panel (no seam),
            bottom deepens so the caption reads. Same #0f0f11 as the form. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f11] via-[#0f0f11]/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f11] via-transparent to-[#0f0f11]/20" />
        {/* subtle gold vignette top-right for warmth */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "radial-gradient(70% 50% at 85% 15%, rgba(168,118,1,0.18), transparent 60%)" }}
        />

        {/* Caption */}
        <div
          className="absolute bottom-14 left-14 right-14 animate-fade-in opacity-0"
          style={{ animationDelay: "320ms", animationFillMode: "forwards" }}
        >
          <div className="mb-4 h-1 w-12 rounded-full bg-[#E0A82E]" />
          <h2 className="font-poppins text-4xl font-bold leading-tight text-neutral-50 drop-shadow">
            Discover Your <span className="text-[#E0A82E]">Dream Car</span>
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-neutral-300">
            Join thousands of satisfied buyers and sellers in our premium automotive marketplace.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;