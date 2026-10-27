import { HomeSceneLayout } from './home-experience';

export default function Layout({ children }: LayoutProps<'/'>) {
  return <HomeSceneLayout>{children}</HomeSceneLayout>;
}
