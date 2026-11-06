'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { useMapTransition } from '@/components/map-transition';
import styles from './home.module.css';

export function HomeSceneLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell} data-home-phase="expanded"><HomeLayout {...baseOptions()}>{children}</HomeLayout></div>;
}

export function HomeExperience({ children }: { children: ReactNode }) {
  const { arrive } = useMapTransition();
  useLayoutEffect(() => { arrive('home'); }, [arrive]);
  return <div className={styles.home}>{children}</div>;
}
