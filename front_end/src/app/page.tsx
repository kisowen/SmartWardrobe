"use client"

import { useState, useEffect } from "react";
import { WebGLShader } from "@/components/ui/web-gl-shader";
import { LiquidButton } from '@/components/ui/liquid-glass-button' 
import { FluidDropdown } from "@/components/ui/fluid-dropdown"; 
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/auth-modal";
import { LogOut, User } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  
  // --- 状态管理 ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);

  // 初始化检查登录状态
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("username");
    if (token && storedUser) {
      setIsLoggedIn(true);
      setUsername(storedUser);
    }
  }, []);

  const handleMainButtonClick = () => {
    if (isLoggedIn) {
      // 已登录：显示菜单
      setShowMenu(true);
    } else {
      // 未登录：显示弹窗
      setShowAuthModal(true);
    }
  };

  const handleLoginSuccess = (data: any) => {
    setIsLoggedIn(true);
    setUsername(data.username);
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUsername("");
    setShowMenu(false);
  };

  const handleNavigation = (path: string) => {
    console.log("Navigating to:", path);
    router.push(path); 
  };

  return (
    <div className="relative flex w-full h-screen flex-col items-center justify-center overflow-hidden bg-black text-white selection:bg-white/20">
      
      <div className="fixed inset-0 z-0 pointer-events-none">
         <WebGLShader/> 
      </div>
      
      {/* 右上角用户信息 (如果已登录) */}
      {isLoggedIn && (
        <div className="absolute top-6 right-6 z-20 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <User className="w-4 h-4" />
            <span className="text-sm font-medium text-white">{username}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            title="退出登录"
          >
            <LogOut className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      )}

      {/* 内容层 */}
      <div className="relative z-10 p-4 w-full max-w-5xl flex flex-col items-center justify-center min-h-[60vh]">
        <main className="flex flex-col items-center text-center space-y-8">
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
                <h1 className="text-white text-5xl md:text-7xl font-extrabold tracking-tighter leading-tight drop-shadow-2xl">
                  基于天气的
                  <br/>
                  <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                    穿搭推荐系统
                  </span>
                </h1>
            </motion.div>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-zinc-400 text-lg md:text-xl font-light tracking-wide max-w-2xl mx-auto"
            >
              AI powered by <span className="text-zinc-200 font-medium">Qwen-VL</span>, <span className="text-zinc-200 font-medium">DeepSeek-R1</span> & <span className="text-zinc-200 font-medium">Kolors</span>
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex items-center justify-center gap-2.5 bg-zinc-900/50 border border-zinc-800 backdrop-blur-md px-5 py-2.5 rounded-full"
            >
                <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <p className="text-sm text-emerald-400 font-medium tracking-wide">
                  System Ready
                </p>
            </motion.div>
            
            {/* 交互区域 */}
            <div className="pt-8 h-32 w-full flex justify-center items-start relative"> 
                <AnimatePresence mode="wait">
                  {!showMenu ? (
                    <motion.div
                      key="button"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10, filter: "blur(5px)" }}
                      transition={{ duration: 0.3 }}
                    >
                      <LiquidButton 
                        className="text-white font-bold tracking-widest px-10 py-6 text-lg" 
                        size={'xl'}
                        onClick={handleMainButtonClick}
                      >
                        {isLoggedIn ? "Let's Go" : "登录 / 注册"}
                      </LiquidButton> 
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full"
                    >
                      <FluidDropdown onSelect={handleNavigation} />
                    </motion.div>
                  )}
                </AnimatePresence>
            </div> 

        </main>
      </div>

      {/* 登录弹窗 */}
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal 
            isOpen={showAuthModal} 
            onClose={() => setShowAuthModal(false)} 
            onLoginSuccess={handleLoginSuccess}
          />
        )}
      </AnimatePresence>

    </div>
  )
}