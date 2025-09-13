import React, { useState } from 'react';
import './App.css';

const API_BASE_URL = 'https://impactlens-7146e9cb7090.herokuapp.com';

function App() {
  const [prompt, setPrompt] = useState('');
  const [input, setInput] = useState('');
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitAnalysis = async () => {
    if (!prompt.trim() || !input.trim()) {
      setError('Please fill in both prompt and input fields');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, input }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit analysis');
      }

      const data = await response.json();
      setJobId(data.job_id);
      pollForResult(data.job_id);
    } catch (err) {
      setError('Error submitting analysis: ' + err.message);
      setLoading(false);
    }
  };

  const pollForResult = async (id) => {
    const maxAttempts = 30; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/results/${id}`);
        const data = await response.json();

        if (data.status === 'completed') {
          setResult(data.result);
          setLoading(false);
        } else if (data.status === 'failed') {
          setError('Analysis failed');
          setLoading(false);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          setError('Analysis timed out');
          setLoading(false);
        }
      } catch (err) {
        setError('Error checking result: ' + err.message);
        setLoading(false);
      }
    };

    poll();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Luxury Partnership Analysis Platform</h1>
        <p>AI-powered insights for luxury brand collaborations</p>
      </header>

      <main className="App-main">
        <div className="analysis-form">
          <div className="form-group">
            <label htmlFor="prompt">Analysis Prompt:</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Analyze potential partners for a luxury watch brand"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="input">Brand Context:</label>
            <textarea
              id="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Swiss heritage brand targeting collectors aged 35-65"
              rows="3"
            />
          </div>

          <button 
            onClick={submitAnalysis} 
            disabled={loading}
            className="submit-btn"
          >
            {loading ? 'Analyzing...' : 'Start Analysis'}
          </button>
        </div>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>AI is analyzing your partnership opportunities...</p>
            {jobId && <p className="job-id">Job ID: {jobId}</p>}
          </div>
        )}

        {error && (
          <div className="error">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="result">
            <h3>Analysis Results</h3>
            <div className="result-content">
              {typeof result === 'string' ? (
                <pre>{result}</pre>
              ) : (
                <pre>{JSON.stringify(result, null, 2)}</pre>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
