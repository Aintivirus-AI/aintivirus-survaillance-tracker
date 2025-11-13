import { useEffect, useState } from 'react';

import { siteConfig } from '../config/site';
import { classNames } from '../utils/classNames';

import MobileMenu from './NavbarMobileMenu';

const ArrowDownIcon = () => (
  <svg
    aria-hidden="true"
    className="nav-icon"
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
    height="20"
    viewBox="0 0 24 24"
    width="20"
  >
    <path
      d="M4 6h16M4 12h16M4 18h16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
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

const Navbar = () => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pathname, setPathname] = useState<string>('/');

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
    document.body.classList.toggle('nav-no-scroll', isMobileMenuOpen);
    return () => {
      document.body.classList.remove('nav-no-scroll');
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className="nav-shell">
        <div className="nav-container">
          <a className="nav-brand" href="https://aintivirus.ai" rel="noreferrer">
            <img
              alt="Aintivirus"
              className="nav-logo"
              height={30}
              src="/logo-alt.png"
              width={189}
            />
          </a>

          <button
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="nav-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            type="button"
          >
            {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <nav aria-label="Primary navigation" className="nav-links">
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
                    <button
                      aria-expanded={Boolean(isParentActive || isChildActive)}
                      aria-haspopup="true"
                      className="nav-link"
                      type="button"
                    >
                      <span
                        className={classNames(
                          'nav-link-text',
                          (isParentActive || isChildActive) && 'nav-link-active',
                        )}
                      >
                        {item.name}
                      </span>
                      <ArrowDownIcon />
                    </button>
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

          <a
            className="nav-cta"
            href={siteConfig.buyLink}
            rel="noreferrer"
            target="_blank"
          >
            Buy AINTI
          </a>
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


