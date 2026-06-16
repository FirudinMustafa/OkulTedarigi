import Header from '@/components/landing/Header'
import Hero from '@/components/landing/Hero'
import BrandScroll from '@/components/landing/BrandScroll'
import Process from '@/components/landing/Process'
import Stats from '@/components/landing/Stats'
import FAQ from '@/components/landing/FAQ'
import CTA from '@/components/landing/CTA'
import Footer from '@/components/landing/Footer'
import ChatWidget from '@/components/landing/ChatWidget'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <Header />
      <main>
        <Hero />
        <BrandScroll />
        <Process />
        <Stats />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  )
}
