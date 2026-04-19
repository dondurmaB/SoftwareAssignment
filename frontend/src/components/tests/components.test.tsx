import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../../api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
  },
  documentApi: {
    list: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getVersions: vi.fn().mockResolvedValue({ data: [] }),
    getPermissions: vi.fn().mockResolvedValue({ data: [] }),
    share: vi.fn(),
    restoreVersion: vi.fn(),
    updatePermission: vi.fn(),
    removePermission: vi.fn(),
  },
  aiApi: {
    getHistory: vi.fn().mockResolvedValue({ data: [] }),
    decideOnSuggestion: vi.fn(),
    cancelInteraction: vi.fn(),
  },
  getValidToken: vi.fn().mockResolvedValue('mock-token'),
}))

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

vi.mock('../../hooks/useCollaboration', () => ({
  useCollaboration: () => ({ connected: false, sendEdit: vi.fn() }),
}))

vi.mock('../../hooks/useAIStream', () => ({
  useAIStream: () => ({
    streaming: false, streamedText: '', interactionId: null, suggestionId: null,
    error: null, startStream: vi.fn(), cancelStream: vi.fn(), reset: vi.fn(),
  }),
}))

vi.mock('../../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}))

import { authApi, documentApi } from '../../api'
import LoginPage from '../../pages/LoginPage'
import RegisterPage from '../../pages/RegisterPage'
import DashboardPage from '../../pages/DashboardPage'
import SaveStatusBar from '../editor/SaveStatusBar'
import PresenceBar from '../editor/PresenceBar'
import { useAuthStore } from '../../store/authStore'

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
    <Toaster />
  </BrowserRouter>
)

// ── LoginPage ─────────────────────────────────────────────────────────────────
describe('LoginPage', () => {
  it('renders email and password inputs', () => {
    render(<Wrapper><LoginPage /></Wrapper>)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('calls authApi.login with email and password on submit', async () => {
    ;(authApi.login as any).mockResolvedValue({
      data: { access_token: 'tok', refresh_token: 'ref', user: { id: 1, email: 'a@a.com', username: 'alice', created_at: '' } },
    })
    render(<Wrapper><LoginPage /></Wrapper>)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@a.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith('a@a.com', 'password123'))
  })

  it('shows link to register page', () => {
    render(<Wrapper><LoginPage /></Wrapper>)
    expect(screen.getByText('Register')).toBeInTheDocument()
  })

  it('shows error toast on failed login', async () => {
    ;(authApi.login as any).mockRejectedValue({ response: { data: { detail: 'Invalid email or password.' } } })
    render(<Wrapper><LoginPage /></Wrapper>)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'bad@a.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByText('Invalid email or password.')).toBeInTheDocument())
  })
})

// ── RegisterPage ──────────────────────────────────────────────────────────────
describe('RegisterPage', () => {
  it('renders all registration fields', () => {
    render(<Wrapper><RegisterPage /></Wrapper>)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('your_username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('calls authApi.register on valid submit', async () => {
    ;(authApi.register as any).mockResolvedValue({
      data: { access_token: 'tok', refresh_token: 'ref', user: { id: 1, email: 'a@a.com', username: 'alice', created_at: '' } },
    })
    render(<Wrapper><RegisterPage /></Wrapper>)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@a.com' } })
    fireEvent.change(screen.getByPlaceholderText('your_username'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(authApi.register).toHaveBeenCalledWith('a@a.com', 'alice', 'password123'))
  })

  it('shows link to login page', () => {
    render(<Wrapper><RegisterPage /></Wrapper>)
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })
})

// ── DashboardPage ─────────────────────────────────────────────────────────────
describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: 'a@a.com', username: 'alice', created_at: '' }, isLoading: false })
    ;(documentApi.list as any).mockResolvedValue({ data: [] })
  })

  it('renders page header with username', async () => {
    render(<Wrapper><DashboardPage /></Wrapper>)
    await waitFor(() => expect(screen.getByText('@alice')).toBeInTheDocument())
  })

  it('renders New Document button', async () => {
    render(<Wrapper><DashboardPage /></Wrapper>)
    await waitFor(() => expect(screen.getByText('New Document')).toBeInTheDocument())
  })

  it('shows empty state when no documents', async () => {
    render(<Wrapper><DashboardPage /></Wrapper>)
    await waitFor(() => expect(screen.getByText(/No documents yet/i)).toBeInTheDocument())
  })

  it('renders document cards when documents exist', async () => {
    ;(documentApi.list as any).mockResolvedValue({
      data: [{
        id: 1, title: 'My Test Doc', owner_user_id: 1, owner_name: 'Alice',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), role: 'owner',
      }],
    })
    render(<Wrapper><DashboardPage /></Wrapper>)
    await waitFor(() => expect(screen.getByText('My Test Doc')).toBeInTheDocument())
  })

  it('opens new document modal on button click', async () => {
    render(<Wrapper><DashboardPage /></Wrapper>)
    await waitFor(() => screen.getByText('New Document'))
    fireEvent.click(screen.getByText('New Document'))
    expect(screen.getByText('New Document', { selector: 'h2' })).toBeInTheDocument()
  })

  it('separates owned and shared documents', async () => {
    ;(documentApi.list as any).mockResolvedValue({
      data: [
        { id: 1, title: 'My Doc', owner_user_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), role: 'owner' },
        { id: 2, title: 'Shared Doc', owner_user_id: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), role: 'editor' },
      ],
    })
    render(<Wrapper><DashboardPage /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Owned by me')).toBeInTheDocument()
      expect(screen.getByText('Shared with me')).toBeInTheDocument()
    })
  })
})

// ── SaveStatusBar ─────────────────────────────────────────────────────────────
describe('SaveStatusBar', () => {
  it('shows Saved', () => {
    render(<SaveStatusBar status="saved" />)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })
  it('shows Saving', () => {
    render(<SaveStatusBar status="saving" />)
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })
  it('shows Unsaved', () => {
    render(<SaveStatusBar status="unsaved" />)
    expect(screen.getByText('Unsaved')).toBeInTheDocument()
  })
  it('shows Save failed', () => {
    render(<SaveStatusBar status="error" />)
    expect(screen.getByText('Save failed')).toBeInTheDocument()
  })
})

// ── PresenceBar ───────────────────────────────────────────────────────────────
describe('PresenceBar', () => {
  it('shows Live when connected', () => {
    render(<PresenceBar users={[]} connected={true} myUserId={1} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows Reconnecting when disconnected', () => {
    render(<PresenceBar users={[]} connected={false} myUserId={1} />)
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument()
  })

  it('shows other users count', () => {
    render(<PresenceBar users={[{ user_id: 2, username: 'bob' }]} connected={true} myUserId={1} />)
    expect(screen.getByText('1 other editing')).toBeInTheDocument()
  })

  it('shows plural when multiple others', () => {
    render(<PresenceBar users={[{ user_id: 2, username: 'bob' }, { user_id: 3, username: 'carol' }]} connected={true} myUserId={1} />)
    expect(screen.getByText('2 others editing')).toBeInTheDocument()
  })

  it('filters out current user from presence display', () => {
    render(<PresenceBar users={[{ user_id: 1, username: 'alice' }, { user_id: 2, username: 'bob' }]} connected={true} myUserId={1} />)
    expect(screen.getByText('1 other editing')).toBeInTheDocument()
  })
})
