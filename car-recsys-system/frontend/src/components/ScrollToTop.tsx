import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Cuộn về đầu trang mỗi khi pathname (đường dẫn) thay đổi
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}