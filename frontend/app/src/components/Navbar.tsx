import { useEffect, useState } from 'react';

import { siteConfig } from '../config/site';
import { classNames } from '../utils/classNames';

import MobileMenu from './NavbarMobileMenu';

const ArrowDownIcon = () => (
  <svg
    aria-hidden="true"
    className="nav-icon nav-arrow"
    fill="none"
    height="16"
    viewBox="0 0 16 16"
    width="16"
  >
    <path
      d="M3.333 6.333 7.813 10.82c.108.108.254.17.407.17.153 0 .299-.062.407-.17L13.108 6.333"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const MenuIcon = () => (
  <svg
    aria-hidden="true"
    className="nav-icon"
    fill="none"
    height="18"
    viewBox="0 0 21 18"
    width="21"
  >
    <path
      d="M1 1h19M1 9h19M1 17h19"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    aria-hidden="true"
    className="nav-icon"
    fill="none"
    height="18"
    viewBox="0 0 18 18"
    width="18"
  >
    <path
      d="m4.5 4.5 9 9m-9 0 9-9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

const LogoIcon = () => (
  <svg
    aria-label="Aintivirus"
    className="nav-logo-svg"
    xmlns="http://www.w3.org/2000/svg"
    width="189"
    height="32"
    viewBox="0 0 189 32"
    fill="none"
  >
    <path
      d="M35.1482 28.8285H39.6598L42.1723 23.4642H52.0758L54.5883 28.8285H59.1457L47.1424 4.01489L35.1482 28.8285ZM50.2601 19.5945H44.0063L47.1515 12.928L50.2601 19.5945Z"
      fill="white"
    />
    <path
      d="M65.5097 4.46436H61.5024V8.57245H65.5097V4.46436Z"
      fill="white"
    />
    <path
      d="M65.5097 11.5894H61.5024V28.8287H65.5097V11.5894Z"
      fill="white"
    />
    <path
      d="M69.9846 28.8287H73.9918V15.4957H81.6579V28.8287H85.6651V11.5894H69.9846V28.8287Z"
      fill="white"
    />
    <path
      d="M94.9628 7.41699H90.9556V11.5893H88.0396V15.1839H90.9556V28.8286H99.7128V25.124H94.9628V15.1839H99.7128V11.5893H94.9628V7.41699Z"
      fill="white"
    />
    <path
      d="M107.214 4.46436H103.207V8.57245H107.214V4.46436Z"
      fill="white"
    />
    <path
      d="M107.214 11.5894H103.207V28.8287H107.214V11.5894Z"
      fill="white"
    />
    <path
      d="M118.749 21.4011L113.789 11.6627L113.743 11.5894H109.222L118.749 29.2505L128.286 11.5894H123.692L118.749 21.4011Z"
      fill="white"
    />
    <path
      d="M134.293 4.46436H130.285V8.57245H134.293V4.46436Z"
      fill="white"
    />
    <path
      d="M134.293 11.5894H130.285V28.8287H134.293V11.5894Z"
      fill="white"
    />
    <path
      d="M138.777 28.8287H142.784V15.4957H148.377V11.5894H138.777V28.8287Z"
      fill="white"
    />
    <path
      d="M162.866 24.9223H155.236V11.5894H151.229V28.8287H166.873V11.5894H162.866V24.9223Z"
      fill="white"
    />
    <path
      d="M184.864 15.4957V11.5894H171.247V22.1805H180.82V24.9223H171.247V28.8287H184.791V18.2375H175.227V15.4957H184.864Z"
      fill="white"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.5703 2.65796L4.19971 7.90312V28.7737L15.5703 23.5286L26.9135 28.7737V7.91229L15.5703 2.65796ZM22.2643 10.8833V21.5112L15.5795 18.4209L8.858 21.5112V10.8833L15.5795 7.79308L22.2643 10.8833Z"
      fill="#00D3FF"
    />
  </svg>
);

const Navbar = () => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pathname, setPathname] = useState<string>('/');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updatePath = () => {
      setPathname(window.location.pathname + window.location.hash);
    };
    updatePath();
    window.addEventListener('hashchange', updatePath);
    window.addEventListener('popstate', updatePath);
    return () => {
      window.removeEventListener('hashchange', updatePath);
      window.removeEventListener('popstate', updatePath);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('nav-no-scroll', isMobileMenuOpen);
    return () => {
      document.body.classList.remove('nav-no-scroll');
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className={classNames('nav-shell', scrolled && !isMobileMenuOpen && 'nav-shell-scrolled')}>
        <div className="nav-bar">
          {/* Logo - Left */}
          <div className="nav-left">
            <a className="nav-brand" href="https://aintivirus.ai" rel="noreferrer">
              <LogoIcon />
            </a>
          </div>

          {/* Menu Links - Center (in pill) */}
          <nav
            aria-label="Primary navigation"
            className={classNames('nav-menu', scrolled && 'nav-menu-scrolled')}
          >
            {siteConfig.navItems.map((item) => {
              const hasChildren = Array.isArray(item.children);
              const isParentActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.includes(item.href)) ||
                pathname.includes(item.name.toLowerCase());
              const isChildActive = hasChildren
                ? item.children!.some((child) => pathname.includes(child.href))
                : false;

              if (hasChildren) {
                return (
                  <div className="nav-item nav-item-parent" key={item.name}>
                    <div className="nav-link-wrapper">
                      <a
                        href={item.href}
                        target={item.target}
                        rel={item.target === '_blank' ? 'noreferrer' : undefined}
                        className={classNames(
                          'nav-link',
                          (isParentActive || isChildActive) && 'nav-link-active',
                        )}
                      >
                        {item.name}
                      </a>
                      <ArrowDownIcon />
                    </div>
                    <div className="nav-dropdown">
                      {item.children!.map((child) => {
                        const childActive = pathname.includes(child.href);
                        return (
                          <a
                            className={classNames(
                              'nav-dropdown-link',
                              childActive && 'nav-dropdown-link-active',
                            )}
                            href={child.href}
                            key={child.name}
                            rel={child.target === '_blank' ? 'noreferrer' : undefined}
                            target={child.target}
                          >
                            {child.name}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <a
                  className={classNames('nav-link nav-item', isParentActive && 'nav-link-active')}
                  href={item.href}
                  key={item.name}
                  rel={item.target === '_blank' ? 'noreferrer' : undefined}
                  target={item.target}
                >
                  {item.name}
                </a>
              );
            })}
          </nav>

          {/* Right side - CTA & Mobile Toggle */}
          <div className="nav-right">
            <button
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="nav-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              type="button"
            >
              {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>

            <a
              className="nav-cta"
              href={siteConfig.buyLink}
              rel="noreferrer"
              target="_blank"
            >
              Buy AINTI
            </a>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        pathname={pathname}
      />
    </>
  );
};

export default Navbar;
