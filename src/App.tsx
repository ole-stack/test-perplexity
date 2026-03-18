import { useState, type FormEvent } from "react";
import "./App.css";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alert(`Innlogging forsøkt med: ${email}`);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Logg inn</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">E-post</label>
          <input
            id="email"
            type="email"
            placeholder="din@epost.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Passord</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">Logg inn</button>
        </form>
      </div>
    </div>
  );
}

export default App;
