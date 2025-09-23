import { useState } from 'react'
import { keyService } from './services/api/keyService'

interface KeyLoan {
  id: string
  keys: string
  contact?: string
  lease?: string
  created_at: string
}

export default function App() {
  const [keyLoans, setKeyLoans] = useState<KeyLoan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const fetchKeyLoans = async () => {
    setLoading(true)
    setError('')
    
    try {
      const loans = await keyService.getAllKeyLoans()
      setKeyLoans(loans)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Keys Portal</h1>
      
      <button 
        onClick={fetchKeyLoans}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Fetch Key Loans'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {keyLoans.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Key Loans ({keyLoans.length})</h2>
          <div className="grid gap-4">
            {keyLoans.map((loan) => (
              <div key={loan.id} className="p-4 border rounded-lg bg-white shadow">
                <div className="text-sm text-gray-500">ID: {loan.id}</div>
                <div className="font-medium">Keys: {loan.keys}</div>
                {loan.contact && <div>Contact: {loan.contact}</div>}
                {loan.lease && <div>Lease: {loan.lease}</div>}
                <div className="text-sm text-gray-500 mt-2">
                  Created: {new Date(loan.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}