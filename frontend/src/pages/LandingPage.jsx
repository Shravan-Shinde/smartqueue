import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Clock,
  QrCode,
  Bell,
  ShieldCheck,
  Building2,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';

/**
 * SmartQueue Landing Page
 * Warm Architectural Visual Presentation Page
 */
const LandingPage = () => {
  const features = [
    {
      icon: Clock,
      title: 'Real-Time Position Tracking',
      description: 'Track your exact position in line and estimated wait time live from your smartphone without standing in crowded waiting rooms.',
      accent: 'pink',
    },
    {
      icon: QrCode,
      title: 'Instant QR Digital Tokens',
      description: 'Scan contactless QR codes at hospital desks, bank branches, or salon counters to join queues instantly.',
      accent: 'lavender',
    },
    {
      icon: Bell,
      title: 'Smart Turn Notifications',
      description: 'Receive automated alerts and notifications when your token is called by counter staff.',
      accent: 'purple',
    },
    {
      icon: ShieldCheck,
      title: 'Atomic Queue Concurrency',
      description: 'Built-in backend concurrency locks ensure two staff counters can never claim or misallocate the same ticket.',
      accent: 'emerald',
    },
  ];

  const orgTypes = [
    { name: 'Hospitals & Clinics', desc: 'OPD, Emergency, Diagnostics', count: '142 Active Queues' },
    { name: 'Banks & Financial Centers', desc: 'Teller, Forex, Accounts', count: '89 Active Queues' },
    { name: 'DMV & Government Offices', desc: 'License, Permits, Verification', count: '56 Active Queues' },
    { name: 'Salons & Services', desc: 'Stylists, Table Reservations', count: '210 Active Queues' },
  ];

  return (
    <div className="min-h-screen bg-sq-surfaceSecondary text-sq-textPrimary font-sans selection:bg-sq-warningBg selection:text-sq-textPrimary">
      {/* Landing Header */}
      <header className="sticky top-0 z-50 bg-sq-surfaceSecondary backdrop-blur-lg border-b border-sq-border px-6 lg:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sq-warningBg p-0.5 shadow-lg shadow-sm flex items-center justify-center">
              <div className="w-full h-full bg-sq-surfaceSecondary rounded-[10px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-sq-textSecondary" />
              </div>
            </div>
            <span className="text-xl font-extrabold tracking-tight">
              Smart<span className="text-sq-textSecondary">Queue</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/discover">
              <Button variant="primary" size="sm">
                Explore Services
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-6 lg:px-12 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
          <Badge variant="pink" size="lg" dot className="mx-auto">
            <Sparkles className="w-4 h-4 mr-1 text-sq-textSecondary" />
            Next-Gen Crowd & Queue Intelligence
          </Badge>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-sq-textPrimary leading-none">
            Skip the crowd.{' '}
            <span className="text-sq-textSecondary">
              Manage your time.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-sq-textSecondary max-w-2xl mx-auto leading-relaxed">
            SmartQueue powers seamless digital queuing across hospitals, banks, public offices, and services with real-time socket tracking, instant check-in QR tokens, and concurrency-locked staff counter operations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/login" className="w-full sm:w-auto">
              <Button variant="primary" size="lg" icon={ArrowRight} className="w-full sm:w-auto">
                Quick Demo Login
              </Button>
            </Link>
            <Link to="/discover" className="w-full sm:w-auto">
              <Button variant="secondary" size="lg" icon={Building2} className="w-full sm:w-auto">
                Discover Partner Services
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 lg:px-12 bg-sq-surface border-y border-sq-border">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-sq-textPrimary tracking-tight">
              Architected for Real-Time Precision
            </h2>
            <p className="text-xs sm:text-sm text-sq-textSecondary max-w-xl mx-auto">
              High-throughput queue infrastructure delivering sub-second WebSocket updates and atomic MongoDB counter claiming.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, idx) => {
              const IconComp = feat.icon;
              return (
                <Card key={idx} variant="elevated" className="bg-sq-surfaceSecondary border border-sq-border space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-sq-surfaceSecondary text-sq-textSecondary flex items-center justify-center font-bold border border-sq-border">
                    <IconComp className="w-6 h-6 text-sq-textSecondary" />
                  </div>
                  <h3 className="text-lg font-bold text-sq-textPrimary">{feat.title}</h3>
                  <p className="text-xs text-sq-textSecondary leading-relaxed">{feat.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Organization Types */}
      <section className="py-20 px-6 lg:px-12 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-sq-textPrimary">
              Built for Every High-Volume Facility
            </h2>
            <p className="text-xs text-sq-textSecondary mt-1">
              Serving healthcare, banking, municipal, and retail establishments.
            </p>
          </div>
          <Link to="/discover">
            <Button variant="secondary" size="sm" icon={ChevronRight}>
              Browse All Categories
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {orgTypes.map((org, idx) => (
            <Card key={idx} variant="surface" className="bg-sq-surface space-y-3 border border-sq-border">
              <span className="text-[10px] font-bold text-sq-textSecondary uppercase tracking-wider block">
                {org.count}
              </span>
              <h4 className="text-base font-bold text-sq-textPrimary">{org.name}</h4>
              <p className="text-xs text-sq-textSecondary">{org.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sq-border py-8 px-6 text-center text-xs text-sq-muted bg-sq-surfaceSecondary">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sq-textSecondary" />
            <span className="font-bold text-sq-textPrimary">SmartQueue Platform © 2026</span>
          </div>
          <p className="text-sq-muted">Real-Time Queue & Crowd Management Platform</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
