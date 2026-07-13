import React from 'react';
import { Link } from 'react-router-dom';
import VideocamIcon from '@mui/icons-material/Videocam';
import ChatIcon from '@mui/icons-material/Chat';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import styles from "../styles/landing.module.css";

export default function LandingPage() {
  return (
    <div className={styles.landingPageContainer}>
      <nav>
        <h2>Meetify</h2>
        <div className={styles.navList}>
          <Link to="/videomeet" className={styles.navButtonGhost}>
            Join as Guest
          </Link>
          <Link to="/auth" className={styles.navButtonGhost}>
            Login
          </Link>
          <Link to="/auth" className={styles.navButton}>
            Sign up free
          </Link>
        </div>
      </nav>

      <div className={styles.landingMainContainer}>
        <div className={styles.leftContent}>
          <h1>
            <span className={styles.highlight}>Connect</span> with your loved ones
          </h1>
          <p>Free, browser-based video calls — no downloads, no plugins. Just share a link.</p>
          <Link className={styles.getStartedBtn} to="/auth">
            Get Started
          </Link>

          <div className={styles.features}>
            <div className={styles.feature}>
              <VideocamIcon />
              <span>HD video &amp; audio</span>
            </div>
            <div className={styles.feature}>
              <ScreenShareIcon />
              <span>Screen sharing</span>
            </div>
            <div className={styles.feature}>
              <ChatIcon />
              <span>Live chat</span>
            </div>
          </div>
        </div>

        <div className={styles.rightImage}>
          <img src="/mobile.png" alt="Meetify running on a mobile phone" />
        </div>
      </div>
    </div>
  );
}
