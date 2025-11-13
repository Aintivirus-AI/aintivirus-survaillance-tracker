import type { MenuItem } from '../config/site';
import { siteConfig } from '../config/site';

const YouTubeIcon = () => (
  <svg aria-hidden="true" fill="currentColor" height="22" viewBox="0 0 24 24" width="22">
    <path d="M21.59 7.2a2.53 2.53 0 0 0-1.78-1.8C18.01 5 12 5 12 5s-6.01 0-7.81.4a2.53 2.53 0 0 0-1.78 1.8A26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .41 4.8 2.53 2.53 0 0 0 1.78 1.8C5.99 19 12 19 12 19s6.01 0 7.81-.4a2.53 2.53 0 0 0 1.78-1.8A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.41-4.8ZM10.3 15.27V8.73L15.65 12Z" />
  </svg>
);

const TelegramIcon = () => (
  <svg aria-hidden="true" fill="currentColor" height="22" viewBox="0 0 24 24" width="22">
    <path d="m21.5 3.17-19.1 7.77a1 1 0 0 0 .05 1.87l4.58 1.66 2.57 4.85a1 1 0 0 0 1.76-.04l2.27-4.42 5.28 3.85a1 1 0 0 0 1.57-.64l1.92-12.2a1 1 0 0 0-1.9-.7l-8.18 6.2-5.6 4.04 7.18-6.12 6.3-4.77Z" />
  </svg>
);

const GitHubIcon = () => (
  <svg aria-hidden="true" fill="currentColor" height="22" viewBox="0 0 24 24" width="22">
    <path d="M12 2a10 10 0 0 0-3.16 19.47c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34a2.65 2.65 0 0 0-1.1-1.46c-.9-.62.07-.61.07-.61a2.1 2.1 0 0 1 1.53 1.03 2.14 2.14 0 0 0 2.92.83 2.14 2.14 0 0 1 .64-1.35c-2.22-.25-4.55-1.11-4.55-4.93a3.86 3.86 0 0 1 1-2.68 3.58 3.58 0 0 1 .1-2.64s.84-.27 2.76 1.02a9.32 9.32 0 0 1 5 0c1.92-1.29 2.76-1.02 2.76-1.02a3.58 3.58 0 0 1 .1 2.64 3.86 3.86 0 0 1 1 2.68c0 3.83-2.34 4.67-4.57 4.92a2.4 2.4 0 0 1 .68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
);

const XIcon = () => (
  <svg aria-hidden="true" fill="currentColor" height="20" viewBox="0 0 24 24" width="20">
    <path d="M20.98 3h-3.6l-4.2 5.43L9.42 3H3.02l6.85 9.83L3.2 21h3.6l4.46-5.77L14.66 21h6.4l-7-10Z" />
  </svg>
);

const SpotifyIcon = () => (
  <svg aria-hidden="true" fill="currentColor" height="22" viewBox="0 0 24 24" width="22">
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.52a.76.76 0 0 1-1.05.26 10.93 10.93 0 0 0-8.94-.86.75.75 0 0 1-.5-1.41 12.45 12.45 0 0 1 10.2 1 .75.75 0 0 1 .29 1.01Zm1.45-2.6a1 1 0 0 1-1.36.35 12.81 12.81 0 0 0-10.44-1.15 1 1 0 1 1-.62-1.9 14.76 14.76 0 0 1 12 1.33 1 1 0 0 1 .42 1.37Zm.15-2.7A1.24 1.24 0 0 1 16.8 11a15.68 15.68 0 0 0-12.8-1.4 1.25 1.25 0 0 1-.7-2.4 18.19 18.19 0 0 1 14.85 1.67 1.24 1.24 0 0 1 .4 1.4Z" />
  </svg>
);

const TikTokIcon = () => (
  <svg aria-hidden="true" fill="currentColor" height="22" viewBox="0 0 24 24" width="22">
    <path d="M19.74 8.4a6.2 6.2 0 0 1-3.78-1.27v6.36a5.52 5.52 0 1 1-5.89-5.5V9.7a2.88 2.88 0 1 0 2.05 2.75V2.75h3.84a2.45 2.45 0 0 0 2.46 2.4h1.32v3.25Z" />
  </svg>
);

type NavItem = MenuItem & { children?: MenuItem[] };

const socialLinks = [
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/@AIntivirusPodcast',
    Icon: YouTubeIcon,
  },
  { name: 'Telegram', href: 'https://t.me/AIntivirus', Icon: TelegramIcon },
  { name: 'GitHub', href: 'https://github.com/aintivirus-AI', Icon: GitHubIcon },
  { name: 'X', href: 'https://x.com/officialmcafee', Icon: XIcon },
  {
    name: 'Spotify',
    href: 'https://open.spotify.com/show/0vH2h9j4mIrPnvnYKbl9Po?si=6i-0wgfGQqCwlIp7eNIb_w&nd=1&dlsi=b4a671ae0aa14396',
    Icon: SpotifyIcon,
  },
  { name: 'TikTok', href: 'https://www.tiktok.com/@johnmcafeeclips', Icon: TikTokIcon },
];

const Footer = () => {
  const navItems = siteConfig.navItems as NavItem[];

  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-center">
          <div className="footer-logo">
            <img alt="Aintivirus" height={48} src="/logo-alt.png" width={160} />
          </div>

          <div className="footer-social">
            {socialLinks.map(({ name, href, Icon }) => (
              <a key={name} aria-label={name} className="footer-social-link" href={href} rel="noreferrer" target="_blank">
                <Icon />
              </a>
            ))}
          </div>
        </div>

        <div className="footer-links">
          {navItems.map((item) => {
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;

            return (
              <div className="footer-column" key={item.name}>
                <a
                  className="footer-heading"
                  href={item.href}
                  rel={item.target === '_blank' ? 'noreferrer' : undefined}
                  target={item.target}
                >
                  {item.name}
                </a>

                {hasChildren ? (
                  <ul className="footer-submenu">
                    {item.children!.map((child) => (
                      <li key={child.name}>
                        <a
                          href={child.href}
                          rel={child.target === '_blank' ? 'noreferrer' : undefined}
                          target={child.target}
                        >
                          {child.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="footer-bottom">
        <span>Copyright ©2025 Antivirus. All rights reserved.</span>
      </div>
    </footer>
  );
};

export default Footer;
