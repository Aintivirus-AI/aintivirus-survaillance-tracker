import { useState } from 'react';
import { siteConfig } from '../config/site';

const YouTubeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="23"
    viewBox="0 0 32 23"
    fill="none"
  >
    <path
      d="M18.8 11.4255L13.9 14.2255V8.62549L18.8 11.4255Z"
      fill="#DBDCDE"
      stroke="#DBDCDE"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 12.4168V10.4344C2 6.3814 2 4.3542 3.267 3.0508C4.5354 1.746 6.5318 1.69 10.5232 1.5766C12.4132 1.5234 14.3452 1.4856 16 1.4856C17.6548 1.4856 19.5854 1.5234 21.4768 1.5766C25.4682 1.69 27.4646 1.746 28.7316 3.0508C29.9986 4.3556 30 6.3828 30 10.4344V12.4154C30 16.4698 30 18.4956 28.733 19.8004C27.4646 21.1038 25.4696 21.1612 21.4768 21.2732C19.5868 21.3278 17.6548 21.3656 16 21.3656C14.3452 21.3656 12.4146 21.3278 10.5232 21.2732C6.5318 21.1612 4.5354 21.1052 3.267 19.8004C1.9986 18.4956 2 16.4684 2 12.4168Z"
      stroke="#DBDCDE"
      strokeWidth="2.1"
    />
  </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="27"
    viewBox="0 0 32 27"
    fill="none"
  >
    <path
      d="M3.71631 12.0166C3.71631 12.0166 16.1002 6.96758 20.3952 5.18979C22.0415 4.47868 27.6251 2.203 27.6251 2.203C27.6251 2.203 30.202 1.20759 29.9873 3.62523C29.9156 4.62082 29.3429 8.10532 28.7702 11.8743C27.9113 17.2078 26.9807 23.0389 26.9807 23.0389C26.9807 23.0389 26.8377 24.6745 25.6208 24.959C24.4038 25.2435 22.3995 23.9634 22.0415 23.6789C21.7553 23.4655 16.6729 20.2655 14.8119 18.7011C14.3107 18.2745 13.738 17.4211 14.8834 16.4255C17.4603 14.0789 20.5384 11.1632 22.3995 9.31433C23.2584 8.46088 24.1175 6.46968 20.5384 8.88751C15.4561 12.372 10.4452 15.6433 10.4452 15.6433C10.4452 15.6433 9.30003 16.3544 7.15255 15.7144C5.00506 15.0743 2.49963 14.2211 2.49963 14.2211C2.49963 14.2211 0.781795 13.1542 3.71668 12.0166H3.71631Z"
      stroke="#DBDCDE"
      strokeWidth="2.1"
    />
  </svg>
);

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
  >
    <path
      d="M14.0001 0C6.26903 0 0 6.42658 0 14.3544C0 20.6967 4.01144 26.0773 9.57412 27.9753C10.2738 28.1082 10.5307 27.664 10.5307 27.2848C10.5307 26.9425 10.5176 25.8117 10.5117 24.6123C6.61677 25.4806 5.79492 22.9186 5.79492 22.9186C5.15808 21.2594 4.24048 20.8184 4.24048 20.8184C2.97031 19.9274 4.33622 19.9456 4.33622 19.9456C5.7421 20.047 6.48238 21.4249 6.48238 21.4249C7.73102 23.6194 9.75749 22.9849 10.5564 22.6183C10.682 21.6904 11.0449 21.0572 11.4452 20.6988C8.33569 20.3357 5.06672 19.1049 5.06672 13.6047C5.06672 12.0376 5.61364 10.757 6.50928 9.75183C6.3639 9.39022 5.88473 7.9303 6.64488 5.95307C6.64488 5.95307 7.82051 5.56726 10.4959 7.42448C11.6126 7.10633 12.8103 6.94692 14.0001 6.94152C15.1898 6.94692 16.3884 7.10633 17.5073 7.42448C20.1795 5.56726 21.3535 5.95307 21.3535 5.95307C22.1155 7.9303 21.6361 9.39022 21.4907 9.75183C22.3883 10.757 22.9315 12.0375 22.9315 13.6047C22.9315 19.118 19.6564 20.332 16.539 20.6873C17.0411 21.1328 17.4885 22.0064 17.4885 23.3455C17.4885 25.2661 17.4723 26.812 17.4723 27.2848C17.4723 27.6668 17.7243 28.1144 18.434 27.9734C23.9936 26.0732 28 20.6945 28 14.3544C28 6.42658 21.7318 0 14.0001 0Z"
      fill="#DBDCDE"
    />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="23"
    viewBox="0 0 22 23"
    fill="none"
  >
    <path
      d="M1 21.4856L9.38711 13.0985M9.38711 13.0985L1 1.4856H6.55556L12.6129 9.87271M9.38711 13.0985L15.4444 21.4856H21L12.6129 9.87271M21 1.4856L12.6129 9.87271"
      stroke="white"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="31"
    viewBox="0 0 32 31"
    fill="none"
  >
    <path
      d="M16 29.4856C23.732 29.4856 30 23.2176 30 15.4856C30 7.75361 23.732 1.4856 16 1.4856C8.26801 1.4856 2 7.75361 2 15.4856C2 23.2176 8.26801 29.4856 16 29.4856Z"
      stroke="#DBDCDE"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.7 15.5823C11.24 15.0643 12.8864 14.7857 14.6 14.7857C17.4336 14.7857 20.088 15.5515 22.3686 16.8857M24.4 12.6857C21.81 10.9189 18.6768 9.88574 15.3 9.88574C13.0642 9.88574 10.9348 10.3393 9 11.1569M20.3806 21.0857C17.5742 19.6434 14.3303 19.3014 11.2848 20.1267"
      stroke="#DBDCDE"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="27"
    height="27"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z"
      stroke="#DBDCDE"
      strokeWidth="2.1"
    />
  </svg>
);

const MediumIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="29"
    viewBox="0 0 28 29"
    fill="currentColor"
  >
    <path
      d="M4.91244 2.04115H23.0876C24.9418 2.04115 26.4444 3.54382 26.4444 5.39804V10.7725C25.4985 11.0194 24.6583 11.567 24.0504 12.3327C23.3162 13.2443 22.8713 14.4747 22.7624 15.8576C22.7396 16.1334 22.7308 16.4093 22.736 16.6852C22.7998 19.4276 24.1049 21.6878 26.4444 22.2074V23.5732C26.4436 24.4632 26.0897 25.3166 25.4603 25.9459C24.831 26.5753 23.9776 26.9292 23.0876 26.93H4.91244C4.0224 26.9292 3.16904 26.5753 2.53968 25.9459C1.91032 25.3166 1.55638 24.4632 1.55556 23.5732V5.39804C1.55556 3.54382 3.05822 2.04115 4.91244 2.04115ZM28 5.39804C27.9992 4.09543 27.4813 2.84641 26.5603 1.92533C25.6392 1.00424 24.3902 0.48642 23.0876 0.485596H4.91244C3.60984 0.48642 2.36082 1.00424 1.43973 1.92533C0.518648 2.84641 0.000824175 4.09543 0 5.39804V23.5732C0.000824175 24.8758 0.518648 26.1248 1.43973 27.0459C2.36082 27.9669 3.60984 28.4848 4.91244 28.4856H23.0876C24.3902 28.4848 25.6392 27.9669 26.5603 27.0459C27.4813 26.1248 27.9992 24.8758 28 23.5732V5.39804ZM26.4444 11.838V14.9227H25.4862C25.5469 13.574 25.8798 12.4649 26.4444 11.838ZM26.4444 15.5154V18.7245C25.7584 17.9265 25.3571 16.78 25.4287 15.5154H26.4444ZM22.862 7.17449L22.8853 7.16982V6.99871H18.3742L14.1898 16.8392L10.0022 6.99871H5.14267V7.16982L5.16444 7.17449C5.98733 7.36115 6.40578 7.63804 6.40578 8.63671V20.3345C6.40578 21.3332 5.98578 21.61 5.16133 21.7967L5.14111 21.7998V21.9709H8.43889V21.7998L8.41556 21.7967C7.59267 21.61 7.17422 21.3332 7.17422 20.3345V9.31493L12.5533 21.9725H12.8582L18.3944 8.96182V20.6223C18.3229 21.4125 17.9091 21.6567 17.164 21.8247L17.1422 21.8294V21.9989H22.8853V21.8278L22.862 21.8247C22.1153 21.6567 21.6922 21.4125 21.6222 20.6223L21.6176 8.63671H21.6222C21.6222 7.63804 22.0407 7.36115 22.862 7.17449Z"
      fill="#DBDCDE"
    />
  </svg>
);

const WhackdIcon = ({ className }: { className?: string }) => (
  <img 
    src="/whackd-white.png" 
    alt="WHACKD" 
    className={className}
    style={{ width: '36px', height: 'auto' }}
  />
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="25" viewBox="0 0 24 25" fill="none">
    <path
      d="M18 6.66821L6 18.6682"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 6.66821L18 18.6682"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LogoIcon = ({ className }: { className?: string }) => (
  <svg
    aria-label="Aintivirus"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 189 32"
    fill="none"
  >
    <path
      d="M35.1482 28.8285H39.6598L42.1723 23.4642H52.0758L54.5883 28.8285H59.1457L47.1424 4.01489L35.1482 28.8285ZM50.2601 19.5945H44.0063L47.1515 12.928L50.2601 19.5945Z"
      fill="white"
    />
    <path d="M65.5097 4.46436H61.5024V8.57245H65.5097V4.46436Z" fill="white" />
    <path d="M65.5097 11.5894H61.5024V28.8287H65.5097V11.5894Z" fill="white" />
    <path d="M69.9846 28.8287H73.9918V15.4957H81.6579V28.8287H85.6651V11.5894H69.9846V28.8287Z" fill="white" />
    <path d="M94.9628 7.41699H90.9556V11.5893H88.0396V15.1839H90.9556V28.8286H99.7128V25.124H94.9628V15.1839H99.7128V11.5893H94.9628V7.41699Z" fill="white" />
    <path d="M107.214 4.46436H103.207V8.57245H107.214V4.46436Z" fill="white" />
    <path d="M107.214 11.5894H103.207V28.8287H107.214V11.5894Z" fill="white" />
    <path d="M118.749 21.4011L113.789 11.6627L113.743 11.5894H109.222L118.749 29.2505L128.286 11.5894H123.692L118.749 21.4011Z" fill="white" />
    <path d="M134.293 4.46436H130.285V8.57245H134.293V4.46436Z" fill="white" />
    <path d="M134.293 11.5894H130.285V28.8287H134.293V11.5894Z" fill="white" />
    <path d="M138.777 28.8287H142.784V15.4957H148.377V11.5894H138.777V28.8287Z" fill="white" />
    <path d="M162.866 24.9223H155.236V11.5894H151.229V28.8287H166.873V11.5894H162.866V24.9223Z" fill="white" />
    <path d="M184.864 15.4957V11.5894H171.247V22.1805H180.82V24.9223H171.247V28.8287H184.791V18.2375H175.227V15.4957H184.864Z" fill="white" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.5703 2.65796L4.19971 7.90312V28.7737L15.5703 23.5286L26.9135 28.7737V7.91229L15.5703 2.65796ZM22.2643 10.8833V21.5112L15.5795 18.4209L8.858 21.5112V10.8833L15.5795 7.79308L22.2643 10.8833Z"
      fill="#00D3FF"
    />
  </svg>
);

const socialLinks = [
  { name: 'YouTube', href: 'https://www.youtube.com/@AIntivirusPodcast', Icon: YouTubeIcon },
  { name: 'Telegram', href: 'https://t.me/AIntivirus', Icon: TelegramIcon },
  { name: 'GitHub', href: 'https://github.com/aintivirus-AI', Icon: GitHubIcon },
  { name: 'X', href: 'https://x.com/officialmcafee', Icon: XIcon },
  { name: 'Spotify', href: 'https://open.spotify.com/show/0vH2h9j4mIrPnvnYKbl9Po?si=6i-0wgfGQqCwlIp7eNIb_w', Icon: SpotifyIcon },
  { name: 'TikTok', href: 'https://www.tiktok.com/@johnmcafeeclips', Icon: TikTokIcon },
  { name: 'Medium', href: 'https://medium.com/@mcafeeaintivirus', Icon: MediumIcon },
  { name: 'WHACKD', href: 'https://www.iwaswhackd.com', Icon: WhackdIcon },
];

const WarrantCanaryModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const suffix =
      day % 10 === 1 && day !== 11 ? 'st' :
      day % 10 === 2 && day !== 12 ? 'nd' :
      day % 10 === 3 && day !== 13 ? 'rd' : 'th';
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    return `${month} ${day}${suffix}, ${year}`;
  };

  const today = formatDate(new Date());

  return (
    <div className="warrant-canary-overlay">
      <div className="warrant-canary-modal">
        <div className="warrant-canary-header">
          <h3 className="warrant-canary-title">Warrant Canary</h3>
          <button className="warrant-canary-close" onClick={onClose} type="button">
            <CloseIcon />
          </button>
        </div>
        <div className="warrant-canary-content">
          <p>
            As of <strong>{today}</strong>, AIntivirus (
            <a href="https://aintivirus.ai" target="_blank" rel="noreferrer">aintivirus.ai</a>
            ) has not received any secret government orders, National Security Letters (NSLs), gag orders, or subpoenas.
          </p>
          <p>
            This statement is updated monthly; if this statement is removed, delayed, or altered, users should reasonably infer that we may have received such an order.
          </p>
        </div>
      </div>
    </div>
  );
};

const Footer = () => {
  const [isWarrantCanaryOpen, setIsWarrantCanaryOpen] = useState(false);
  const firstColumnItems = siteConfig.footerItems.slice(0, 3);
  const secondColumnItems = siteConfig.footerItems.slice(3);

  return (
    <footer className="footer">
      <div className="footer-glow" aria-hidden="true" />
      
      <div className="footer-content">
        {/* Left column */}
        <div className="footer-links-column footer-links-left">
          {firstColumnItems.map((item) => (
            <a
              key={item.name}
              className="footer-link"
              href={item.href}
              rel={item.target === '_blank' ? 'noreferrer' : undefined}
              target={item.target}
            >
              {item.name}
            </a>
          ))}
        </div>

        {/* Center column */}
        <div className="footer-center">
          <div className="footer-logo">
            <LogoIcon className="footer-logo-svg" />
          </div>
          <p className="footer-tagline">
            Promoting the ideas and legacy of John McAfee
          </p>
          <div className="footer-social">
            {socialLinks.map(({ name, href, Icon }) => (
              <a
                key={name}
                aria-label={name}
                className="footer-social-link"
                href={href}
                rel="noreferrer"
                target="_blank"
              >
                <Icon className="footer-social-icon" />
              </a>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="footer-links-column footer-links-right">
          {secondColumnItems.map((item) => (
            <a
              key={item.name}
              className="footer-link"
              href={item.href}
              rel={item.target === '_blank' ? 'noreferrer' : undefined}
              target={item.target}
            >
              {item.name}
            </a>
          ))}
          <button
            className="footer-link footer-link-button"
            onClick={() => setIsWarrantCanaryOpen(true)}
            type="button"
          >
            Warrant Canary
          </button>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-line footer-bottom-line-top" aria-hidden="true" />
        <div className="footer-bottom-line footer-bottom-line-bottom" aria-hidden="true" />
        <span className="footer-copyright">Copyright ©2025 Antivirus. All rights reserved</span>
      </div>

      <WarrantCanaryModal
        isOpen={isWarrantCanaryOpen}
        onClose={() => setIsWarrantCanaryOpen(false)}
      />
    </footer>
  );
};

export default Footer;
