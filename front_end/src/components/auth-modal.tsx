"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, User, Lock, Loader2, ArrowRight } from "lucide-react"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (userData: any) => void
}

const API_BASE_URL = "http://127.0.0.1:8000"

export function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true) // true=登录, false=注册
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      let url = ""
      let body: any = null
      let headers = {}

      if (isLogin) {
        // 登录接口 (OAuth2 表单格式)
        url = `${API_BASE_URL}/token`
        const formData = new URLSearchParams()
        formData.append("username", username)
        formData.append("password", password)
        body = formData
        headers = { "Content-Type": "application/x-www-form-urlencoded" }
      } else {
        // 注册接口 (JSON格式)
        url = `${API_BASE_URL}/register`
        body = JSON.stringify({ username, password })
        headers = { "Content-Type": "application/json" }
      }

      const res = await fetch(url, { method: "POST", headers, body })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || "请求失败")

      // 登录成功：保存Token
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("user_id", data.user_id)
      localStorage.setItem("username", data.username)
      
      onLoginSuccess(data)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
      >
        {/* 关闭按钮 */}
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              {isLogin ? "欢迎回来" : "创建账户"}
            </h2>
            <p className="text-sm text-zinc-400">
              {isLogin ? "登录以访问您的智能衣橱" : "注册开启您的AI穿搭之旅"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-500 ml-1">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-white transition-colors"
                  placeholder="请输入用户名"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-500 ml-1">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-white transition-colors"
                  placeholder="请输入密码"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 text-xs text-red-200 bg-red-900/30 border border-red-900/50 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {isLogin ? "登录" : "注册"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              {isLogin ? "没有账号？点击注册" : "已有账号？点击登录"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}