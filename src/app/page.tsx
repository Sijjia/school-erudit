import type { Metadata } from 'next';
import LandingPage from '@/shared/components/marketing/LandingPage';

export const metadata: Metadata = {
  title: 'Bilim OS — единая система управления школой',
  description:
    'Журнал, оценки, расписание, аналитика и общение в одном месте, с доступом по ролям. Школьная ERP для частных школ. Живое демо без установки.',
};

export default function Home() {
  return <LandingPage />;
}
