import { useEffect, useState } from 'react';

import { siteConfig } from '../config/site';
import { classNames } from '../utils/classNames';

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

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
}

const MobileMenu = ({ isOpen, onClose, pathname }: MobileMenuProps) => {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setOpenSubmenu(null);
    }
  }, [isOpen]);

  return (
    <div className={classNames('nav-mobile', isOpen && 'nav-mobile-open')}>
      <div className="nav-mobile-backdrop" onClick={onClose} />
      <div className="nav-mobile-panel">
        <nav aria-label="Mobile navigation">
          <ul className="nav-mobile-list">
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
                const isOpenSubmenu = openSubmenu === item.name;
                return (
                  <li className="nav-mobile-item" key={item.name}>
                    <button
                      className={classNames(
                        'nav-mobile-button',
                        (isParentActive || isChildActive) && 'nav-mobile-button-active',
                      )}
                      onClick={() =>
                        setOpenSubmenu(isOpenSubmenu ? null : item.name)
                      }
                      type="button"
                    >
                      <span>{item.name}</span>
                      <ArrowDownIcon />
                    </button>
                    <ul
                      className={classNames(
                        'nav-mobile-submenu',
                        isOpenSubmenu && 'nav-mobile-submenu-open',
                      )}
                    >
                      {item.children!.map((child) => {
                        const childActive = pathname.includes(child.href);
                        return (
                          <li className="nav-mobile-subitem" key={child.name}>
                            <a
                              className={classNames(
                                'nav-mobile-link',
                                childActive && 'nav-mobile-link-active',
                              )}
                              href={child.href}
                              onClick={onClose}
                              rel={
                                child.target === '_blank' ? 'noreferrer' : undefined
                              }
                              target={child.target}
                            >
                              {child.name}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              }

              return (
                <li className="nav-mobile-item" key={item.name}>
                  <a
                    className={classNames(
                      'nav-mobile-link',
                      (isParentActive || isChildActive) && 'nav-mobile-link-active',
                    )}
                    href={item.href}
                    onClick={onClose}
                    rel={item.target === '_blank' ? 'noreferrer' : undefined}
                    target={item.target}
                  >
                    {item.name}
                  </a>
                </li>
              );
            })}
            <li className="nav-mobile-item nav-mobile-cta-item">
              <a
                className="nav-mobile-cta"
                href={siteConfig.buyLink}
                onClick={onClose}
                rel="noreferrer"
                target="_blank"
              >
                Buy AINTI
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default MobileMenu;


