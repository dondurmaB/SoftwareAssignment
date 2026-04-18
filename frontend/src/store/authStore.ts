import { create } from 'zustand'
import type { User } from '../types'
import api from '../api/client'
import { authApi } from '../api'

interface AuthState {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  init: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await authApi.login(email, password)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ user: data.user })
  },

  register: async (email, username, password) => {
    const { data } = await authApi.register(email, username, password)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ user: data.user })
  },

  logout: async () => {
    const rt = localStorage.getItem('refresh_token') ?? ''
    try { await authApi.logout(rt) } catch {}
    localStorage.clear()
    set({ user: null })
  },

  init: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) { set({ isLoading: false }); return }
    try {
      const { data } = await api.get<User>('/api/auth/me')
      set({ user: data, isLoading: false })
    } catch {
      const rt = localStorage.getItem('refresh_token')
      if (!rt) { localStorage.clear(); set({ isLoading: false }); return }
      try {
        const { data } = await authApi.refresh(rt)
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        set({ user: data.user, isLoading: false })
      } catch {
        localStorage.clear()
        set({ user: null, isLoading: false })
      }
    }
  },
}))
