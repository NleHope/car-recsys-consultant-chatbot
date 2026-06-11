import { Link, useNavigate } from "react-router-dom";
import { User as UserIcon, Heart, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import ThemeToggle from "@/components/ThemeToggle";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { isAuthenticated, getCurrentUser, authApi } from "@/lib/api";

const Header = () => {
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();
  const user = loggedIn ? getCurrentUser() : null;
  const initial = (user?.username?.[0] ?? "?").toUpperCase();

  const handleLogout = () => {
    authApi.logout();
    // Full reload so the header re-reads auth state from the cleared localStorage.
    window.location.assign("/");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">

          <div className="flex items-center gap-8">
            <Link to="/" className="font-body text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Car<span className="text-[#A87601]">Market</span>
            </Link>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <NavLink
              to="/"
              className="text-base font-semibold text-foreground/70 transition-all hover:bg-[#A87601]/10 hover:text-[#A87601] hover:scale-105 rounded-md px-3 py-2"
              end
            >
              Home
            </NavLink>
            <NavLink
              to="/search"
              className="text-base font-semibold text-foreground/70 transition-all hover:bg-[#A87601]/10 hover:text-[#A87601] hover:scale-105 rounded-md px-3 py-2"
            >
              Browse
            </NavLink>
            <NavLink
              to="/sell"
              className="text-base font-semibold text-foreground/70 transition-all hover:bg-[#A87601]/10 hover:text-[#A87601] hover:scale-105 rounded-md px-3 py-2"
            >
              Sell
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {loggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Account menu" className="rounded-full outline-none focus:ring-2 focus:ring-primary">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="truncate">
                    {user?.full_name || user?.username || "Account"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserIcon className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/favorites")}>
                    <Heart className="mr-2 h-4 w-4" /> Favorites
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/login"
                className="relative text-base font-semibold text-foreground/70 transition-all duration-200 hover:text-[#A87601] hover:scale-105 group px-1"
              >
                Login
                <span className="absolute left-0 -bottom-0.5 h-[2px] w-0 bg-[#A87601] transition-all duration-200 group-hover:w-full rounded-full" />
              </Link>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;
