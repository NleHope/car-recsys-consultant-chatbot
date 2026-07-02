import { Link } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import carFooterImage from "@/images/car_footer.jpg";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const bgImage = carFooterImage;

  const footerLinks = {
    company: [
      { label: "About Us", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Blog", href: "#" },
    ],
    support: [
      { label: "Help Center", href: "#" },
      { label: "Contact Us", href: "#" },
      { label: "FAQs", href: "#" },
      { label: "Safety", href: "#" },
    ],
    legal: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Cookie Policy", href: "#" },
      { label: "Accessibility", href: "#" },
    ],
  };

  return (
    <footer className="relative border-t border-border overflow-hidden">
      {/* Main footer content */}
      <div className="relative container mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-border/40">
          {/* Background image - less blur like hero */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <img
              src={bgImage}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover scale-105"
              style={{ objectPosition: "center 40%" }}
            />
          </div>

          <div className="relative p-8 md:p-10">
            {/* Brand section */}
            <div className="mb-12">
              <Link to="/" className="inline-block mb-6">
                <span className="font-body text-4xl font-semibold tracking-tight text-white">
                  Car<span className="text-[#A87601]">Market</span>
                </span>
              </Link>
              <p className="text-white mb-6 whitespace-nowrap leading-relaxed">
                Your trusted destination for luxury and exotic vehicles. We connect
                discerning buyers with premium automobiles from around the world.
              </p>
              <div className="space-y-3">
                <a
                  href="mailto:hello@carmarket.com"
                  className="flex items-center gap-3 text-sm text-white hover:text-[#A87601] transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  hello@carmarket.com
                </a>
                <a
                  href="tel:+15550123456"
                  className="flex items-center gap-3 text-sm text-white hover:text-[#A87601] transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  +1 (555) 012-3456
                </a>
                <p className="flex items-center gap-3 text-sm text-white">
                  <MapPin className="h-4 w-4" />
                  Los Angeles, California
                </p>
              </div>
            </div>

            {/* Links sections - all on same row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
              <div>
                <h4 className="font-poppins text-sm font-semibold text-white uppercase tracking-wider mb-4">
                  Company
                </h4>
                <ul className="space-y-3">
                  {footerLinks.company.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-white hover:text-[#A87601] transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-poppins text-sm font-semibold text-white uppercase tracking-wider mb-4">
                  Support
                </h4>
                <ul className="space-y-3">
                  {footerLinks.support.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-white hover:text-[#A87601] transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-poppins text-sm font-semibold text-white uppercase tracking-wider mb-4">
                  Legal
                </h4>
                <ul className="space-y-3">
                  {footerLinks.legal.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-white hover:text-[#A87601] transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-border">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-black">
            © {currentYear} <span className="font-body font-semibold tracking-tight text-black">Car<span className="text-[#A87601]">Market</span></span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;