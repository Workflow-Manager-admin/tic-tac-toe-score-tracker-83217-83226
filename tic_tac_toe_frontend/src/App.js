import React, { useState, useEffect } from 'react';
import './App.css';

// Backend endpoint base URL (adjust as per deployment)
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

//////////////////////////////////////////////////////////////////////////////
// PUBLIC_INTERFACE
function App() {
  // Theme
  const [theme, setTheme] = useState('light');

  // Auth/User
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // {id, username, ...}
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [registerData, setRegisterData] = useState({username: '', email: ''});
  const [registerError, setRegisterError] = useState('');

  // Game
  const [opponentList, setOpponentList] = useState([]);
  const [startGameModalOpen, setStartGameModalOpen] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [currentGame, setCurrentGame] = useState(null); // {game_id, board, ...}
  const [gameError, setGameError] = useState('');
  const [moveLoading, setMoveLoading] = useState(false);

  // UI
  const [view, setView] = useState('game'); // 'game', 'leaderboard', 'history'

  // Leaderboard/History
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // On mount: fetch users for registration/opponent selection
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch users from backend
  // PUBLIC_INTERFACE
  async function fetchUsers() {
    try {
      const resp = await fetch(`${API_BASE_URL}/users/`);
      if (resp.ok) {
        const data = await resp.json();
        setUsers(data);
        // For opponent selection, remove currentUser from the list
        if (currentUser) {
          setOpponentList(data.filter(u => u.id !== currentUser.id));
        } else {
          setOpponentList(data);
        }
      }
    } catch (err) {
      // ignore error (server down etc) for now
    }
  }

  // Register user
  // PUBLIC_INTERFACE
  async function registerUser(e) {
    e.preventDefault();
    setRegisterError('');
    try {
      const resp = await fetch(`${API_BASE_URL}/users/`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(registerData),
      });
      if (resp.status === 201) {
        const newUser = await resp.json();
        setCurrentUser(newUser);
        setAuthModalOpen(false);
        setRegisterData({username: '', email: ''});
        setRegisterError('');
        fetchUsers();
      } else {
        const msg = await resp.json();
        setRegisterError(msg?.detail?.[0]?.msg || "Registration failed (make sure username is unique and all fields are filled)");
      }
    } catch (err) {
      setRegisterError("Network error, try again later.");
    }
  }

  // Start new game
  // PUBLIC_INTERFACE
  async function startNewGame(e) {
    e.preventDefault();
    setGameError('');
    if (!selectedOpponent) {
      setGameError('Please select an opponent.');
      return;
    }
    try {
      const resp = await fetch(`${API_BASE_URL}/games/`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          player_x_id: currentUser.id,
          player_o_id: parseInt(selectedOpponent, 10),
        }),
      });
      if (resp.ok) {
        const game = await resp.json();
        setCurrentGame({
          ...game,
          game_id: game.game_id || game.id, // some APIs may have different key
        });
        setStartGameModalOpen(false);
        setView('game');
      } else {
        setGameError("Unable to start game. Please try again.");
      }
    } catch (err) {
      setGameError("Network error when starting game.");
    }
  }

  // Make move
  // PUBLIC_INTERFACE
  async function makeMove(row, col) {
    if (!currentGame || moveLoading) return;
    if (currentGame.board[row][col]) return; // Already filled
    setMoveLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/games/move/`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          user_id: currentUser.id,
          game_id: currentGame.game_id,
          row,
          col
        }),
      });
      if (resp.ok) {
        const moveResult = await resp.json();
        setCurrentGame(prev => ({
          ...prev,
          board: moveResult.board,
          status: moveResult.status,
          winner: moveResult.winner,
          next_player: moveResult.next_player,
        }));
        setGameError('');
      } else {
        const msg = await resp.json();
        setGameError(msg?.detail?.[0]?.msg || "Error making move.");
      }
    } catch (err) {
      setGameError("Network error when making move.");
    }
    setMoveLoading(false);
  }

  // Refresh leaderboard
  // PUBLIC_INTERFACE
  async function fetchLeaderboard() {
    setLeaderboardLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/leaderboard/`);
      if (resp.ok) {
        const data = await resp.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch {}
    setLeaderboardLoading(false);
  }

  // Refresh history
  // PUBLIC_INTERFACE
  async function fetchHistory() {
    if (!currentUser) return;
    setHistoryLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/users/${currentUser.id}/history/`);
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data);
      }
    } catch {}
    setHistoryLoading(false);
  }

  // Start new game modal
  function openStartGameModal() {
    fetchUsers(); // Refresh opponent list
    setStartGameModalOpen(true);
    setSelectedOpponent('');
    setGameError('');
  }

  // Auth modal
  function openAuthModal() {
    setAuthModalOpen(true);
    setRegisterData({username: '', email: ''});
    setRegisterError('');
  }

  //////////////////////////////////////////////////////////////////////////
  // Game Board UI

  function renderGameStatus(game) {
    if (!game) return '';
    if (game.status === 'finished') {
      if (game.winner) {
        return <p className="status game-over">🎉 Winner: <strong>{game.winner}</strong>!</p>;
      }
      return <p className="status draw">It's a draw!</p>;
    }
    return <p className="status">
      Next player: <strong>{game.next_player || 'N/A'}</strong>
      &nbsp;Status: <span>{game.status}</span>
    </p>;
  }

  function renderBoard(game) {
    if (!game?.board) return null;
    return (
      <div className="ttt-board">
        {game.board.map((row, rowIdx) => (
          <div key={rowIdx} className="ttt-row">
            {row.map((cell, colIdx) => (
              <button
                key={colIdx}
                className={"ttt-cell" + (cell ? " filled" : "")}
                disabled={!isPlayerTurn(game, rowIdx, colIdx)}
                onClick={() => makeMove(rowIdx, colIdx)}
                aria-label={`Cell ${rowIdx+1},${colIdx+1}`}
              >
                {cell || ""}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  function isPlayerTurn(game, row, col) {
    // Can click only if game is ongoing, cell is empty, and it's this user's turn
    if (game.status !== "ongoing") return false;
    if (game.board[row][col]) return false;
    if (game.next_player && getCurrentPlayerSymbol(game) !== game.next_player)
      return false;
    return true;
  }

  function getCurrentPlayerSymbol(game) {
    if (!game) return null;
    if (currentUser && currentUser.id === game.player_x_id) return "X";
    if (currentUser && currentUser.id === game.player_o_id) return "O";
    return null;
  }

  //////////////////////////////////////////////////////////////////////////
  // Handler for navigation menu
  function handleNavClick(tab) {
    setView(tab);
    // Prefetch leaderboard/history on tab switch
    if (tab === 'leaderboard') fetchLeaderboard();
    if (tab === 'history') fetchHistory();
  }

  //////////////////////////////////////////////////////////////////////////
  // MAIN RENDER

  return (
    <div className="App">
      <header className="App-header">
        {/* THEME TOGGLE */}
        <button
          className="theme-toggle"
          onClick={() => setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light')}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>

        {/* APP TITLE & NAV */}
        <div className="navbar">
          <h1 className="title">Tic Tac Toe</h1>
          <nav>
            <button className={"nav-btn" + (view === 'game' ? ' active' : '')} onClick={() => handleNavClick('game')}>
              Game
            </button>
            <button className={"nav-btn" + (view === 'leaderboard' ? ' active' : '')} onClick={() => handleNavClick('leaderboard')}>
              Leaderboard
            </button>
            <button className={"nav-btn" + (view === 'history' ? ' active' : '')} onClick={() => handleNavClick('history')} disabled={!currentUser}>
              My History
            </button>
          </nav>
        </div>

        {/* AUTH BAR */}
        <div className="auth-bar">
          {currentUser ? (
            <span>
              Signed in as <strong>{currentUser.username}</strong>
              <button className="btn small" onClick={
                () => { setCurrentUser(null); setCurrentGame(null); setHistory([]); }
              }>Sign out</button>
            </span>
          ) : (
            <button className="btn" onClick={openAuthModal}>Sign in / Register</button>
          )}
        </div>

        {/* MAIN VIEW */}
        <main>
          {/* New Game Button */}
          {(view === 'game') && (
            <>
              {!currentUser ? (
                <div style={{margin:'30px 0'}}>Please sign in to play.</div>
              ) : (
                <div className="game-section">
                  <button className="btn large" onClick={openStartGameModal}>Start New Game</button>
                  {/* Game Board */}
                  {currentGame &&
                    <div className="ttt-section">
                      <h2>Current Game</h2>
                      {renderGameStatus(currentGame)}
                      {renderBoard(currentGame)}
                      {gameError && <p className="error">{gameError}</p>}
                    </div>
                  }
                  {!currentGame && <div className="hint-text">Click "Start New Game" to play!</div>}
                </div>
              )}
            </>
          )}

          {/* Leaderboard */}
          {(view === 'leaderboard') && (
            <section className="leaderboard-section">
              <h2>Leaderboard</h2>
              {leaderboardLoading ? <p>Loading...</p> :
                <LeaderboardTable leaderboard={leaderboard} />
              }
            </section>
          )}

          {/* History */}
          {(view === 'history') && (
            <section className="history-section">
              <h2>My Game History</h2>
              {historyLoading ? <p>Loading...</p> :
                <HistoryTable history={history} currentUser={currentUser} />
              }
            </section>
          )}
        </main>
      </header>

      {/* AUTH MODAL */}
      {authModalOpen && (
        <Modal title="Sign in / Register" onClose={() => setAuthModalOpen(false)}>
          <form className="auth-form" onSubmit={registerUser}>
            <label>
              Username:
              <input type="text" value={registerData.username} required
                onChange={e => setRegisterData(d => ({...d, username: e.target.value}))}/>
            </label>
            <label>
              Email:
              <input type="email" value={registerData.email} required
                onChange={e => setRegisterData(d => ({...d, email: e.target.value}))}/>
            </label>
            {registerError && <div className="error">{registerError}</div>}
            <button className="btn large" type="submit">Register / Sign in</button>
          </form>
        </Modal>
      )}
      {/* START GAME MODAL */}
      {startGameModalOpen && (
        <Modal title="Start New Game" onClose={() => setStartGameModalOpen(false)}>
          <form className="start-game-form" onSubmit={startNewGame}>
            <label>
              Opponent:
              <select value={selectedOpponent} required
                onChange={e => setSelectedOpponent(e.target.value)}>
                <option value="">Select...</option>
                {opponentList.map(o =>
                  <option key={o.id} value={o.id}>{o.username} ({o.email})</option>
                )}
              </select>
            </label>
            {gameError && <div className="error">{gameError}</div>}
            <button className="btn large" type="submit">Start Game</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

//////////////////////////////////////////////////////////////////////////////
// Simple Modal
function Modal({title, onClose, children}) {
  return (
    <div className="modal-backdrop" role="dialog">
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// Leaderboard Table Component
function LeaderboardTable({leaderboard}) {
  if (!leaderboard?.length) return <div>No players yet.</div>;
  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th>Rank</th><th>Username</th><th>Wins</th><th>Losses</th><th>Draws</th>
        </tr>
      </thead>
      <tbody>
        {leaderboard.map((row, idx) => (
          <tr key={row.user_id}>
            <td>{idx+1}</td>
            <td>{row.username}</td>
            <td>{row.wins}</td>
            <td>{row.losses}</td>
            <td>{row.draws}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Game History Table Component
function HistoryTable({history, currentUser}) {
  if (!history?.length) return <div>No games played yet.</div>;
  return (
    <table className="history-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Opponent</th>
          <th>Played As</th>
          <th>Started</th>
          <th>Finished</th>
          <th>Winner</th>
        </tr>
      </thead>
      <tbody>
        {history.map((h, idx) => {
          const playedAs = h.player_x === currentUser.username ? 'X' : 'O';
          const opponent = playedAs === 'X' ? h.player_o : h.player_x;
          return (
            <tr key={h.game_id}>
              <td>{idx+1}</td>
              <td>{opponent}</td>
              <td>{playedAs}</td>
              <td>{h.started_at && (new Date(h.started_at)).toLocaleString()}</td>
              <td>{h.finished_at && (new Date(h.finished_at)).toLocaleString()}</td>
              <td>{h.winner || <span className="draw">Draw</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default App;
