import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  return (
    <div style={{ padding: 24 }}>
      <h1>ONECore – Keys Portal</h1>
      <p>Vite + React + TS är igång.</p>
      <button onClick={() => setCount(c => c + 1)}>Clicked {count} times</button>
    </div>
  )
}
