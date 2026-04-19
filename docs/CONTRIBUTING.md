# Contributing Guide

## Development Setup

See `README.md` for initial setup instructions.

## Code Standards

### Backend (Node.js/Express)

**File Structure:**
```
backend/src/
├── server.js          # Express app entry point
├── routes/            # API endpoint handlers
├── services/          # Business logic
├── middleware/        # Express middleware
└── utils/             # Helper functions
```

**Coding Style:**

Use async/await for asynchronous operations (no callbacks):
```javascript
// Good
router.post('/api/transcribe', async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'Missing file' });

    const job = await transcribeQueue.add({ file });
    res.json({ jobId: job.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bad - using callbacks
router.post('/api/transcribe', (req, res) => {
  transcribeQueue.add(req.body.file, (err, job) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ jobId: job.id });
  });
});
```

**Error Handling:**
- Always wrap async operations in try/catch
- Return appropriate HTTP status codes
- Log errors with context (not just the message)
- Return user-friendly error messages

**Input Validation:**
- Validate all user inputs before processing
- Check required fields
- Validate data types and formats
- Return 400 Bad Request for invalid input

Example:
```javascript
router.post('/api/transcribe', async (req, res) => {
  const { fileBuffer, fileName } = req.body;

  // Validation
  if (!fileBuffer) {
    return res.status(400).json({ error: 'Missing fileBuffer' });
  }
  if (!fileName) {
    return res.status(400).json({ error: 'Missing fileName' });
  }
  if (fileBuffer.length > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File too large' });
  }

  // Processing
  try {
    // ... rest of logic
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});
```

### Frontend (React)

**File Structure:**
```
frontend/src/
├── main.jsx           # React entry point
├── App.jsx            # Root component
├── components/        # Reusable UI components
├── pages/             # Full page components
├── hooks/             # Custom React hooks
├── utils/             # Helper functions
└── styles/            # Global styles
```

**Component Design:**
- Use functional components with hooks (no class components)
- Keep components small and focused (< 100 lines if possible)
- Use meaningful, descriptive names
- Export at bottom of file

Example:
```javascript
// Good - small, focused component
export function FileUploadButton({ onUpload }) {
  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) onUpload(file);
    };
    input.click();
  };

  return (
    <button onClick={handleClick} className="px-4 py-2 bg-blue-600 text-white rounded">
      Upload Audio
    </button>
  );
}

// Bad - too many responsibilities
export function ComplexUploadManager({ /* many props */ }) {
  // 200+ lines of code
}
```

**State Management:**
- Use React hooks (useState, useEffect, useContext)
- Use Zustand for global state (if needed, planned for Phase 2)
- Props for component-specific state
- Keep state as local as possible

**Styling:**
- Use TailwindCSS classes (no CSS files for new code)
- Use utility classes instead of creating custom classes
- Follow responsive design patterns
- Test on mobile viewports

Example:
```javascript
// Good - TailwindCSS utilities
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Card>Content</Card>
</div>

// Bad - custom CSS
<div className="custom-layout">
  <Card>Content</Card>
</div>
```

**Error Handling:**
- Show user-friendly error messages
- Handle loading states
- Use try/catch in async functions
- Provide retry options when appropriate

```javascript
export function TranscriptionResult({ jobId }) {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await fetch(`/api/transcribe/${jobId}`);
        if (!response.ok) throw new Error('Failed to fetch result');
        const data = await response.json();
        setResult(data);
        setStatus('loaded');
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    };

    fetchResult();
  }, [jobId]);

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p>Error: {error}</p>;
  return <div>{result.transcript}</div>;
}
```

## Git Commits

### Commit Message Format

```
type(scope): description
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `chore` - Setup, dependencies, tooling
- `docs` - Documentation changes
- `test` - Test additions or modifications
- `refactor` - Code cleanup (no behavior change)
- `perf` - Performance improvements

**Scope:**
- `backend` - Backend code
- `frontend` - Frontend code
- `docs` - Documentation
- `config` - Configuration files
- `deps` - Dependencies

**Examples:**
```
feat(backend): add file upload endpoint
fix(frontend): fix audio playback error
chore(deps): upgrade express to v4.19
docs: add troubleshooting section
test(backend): add api tests
```

### Commit Best Practices

- Commit frequently (after completing a feature or fix)
- Make commits atomic (one logical change per commit)
- Write descriptive commit messages
- Don't commit .env or sensitive files
- Run tests before committing

## Testing

### Running Tests

```bash
# Backend API tests
cd backend
npm run test:api

# Frontend tests (when added)
cd frontend
npm run test
```

### Test Standards

- Test new features before submitting
- Aim for > 80% code coverage
- Test error cases, not just happy path
- Use descriptive test names

Example:
```javascript
describe('transcribeRoute', () => {
  it('should return 400 if file is missing', async () => {
    const response = await request(app).post('/api/transcribe').send({});
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should queue transcription job', async () => {
    const response = await request(app)
      .post('/api/transcribe')
      .send({ file: mockFile });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jobId');
  });
});
```

## Code Review Checklist

Before submitting code for review:

- [ ] Code follows style guide (async/await, no callbacks)
- [ ] Input validation is present
- [ ] Error handling is implemented
- [ ] Comments explain complex logic
- [ ] No console.logs or debugging code
- [ ] Tests pass (if applicable)
- [ ] No breaking changes
- [ ] Commit messages are clear
- [ ] .env and secrets are not committed

## Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make changes**
   - Write code following standards
   - Test as you go

3. **Commit changes**
   ```bash
   git add src/my-file.js
   git commit -m "feat(backend): add my feature"
   ```

4. **Push and create PR** (when using GitHub)
   ```bash
   git push origin feat/my-feature
   ```

5. **Review and merge**
   - Address review comments
   - Merge to main branch

## Debugging

### Backend Debugging

**Console Logging:**
```javascript
// Use console.error for errors
console.error('Transcription failed:', error);

// Use console.log for info (remove before commit)
console.log('Job queue size:', queue.count());
```

**Environment Variables:**
Check that `.env` is present and properly formatted:
```bash
cat .env | grep API_KEY
```

**API Testing:**
```bash
curl http://localhost:3000/health
npm run test:api
```

### Frontend Debugging

**Browser DevTools:**
- Use React DevTools extension
- Check Network tab for API calls
- Use Console for errors

**Quick Debug:**
```javascript
// Temporarily add this to debug state changes
console.log('State updated:', { status, error, result });
```

## Performance Tips

**Backend:**
- Use `npm run dev` with nodemon for auto-restart
- Monitor console for slow operations
- Use middleware in correct order

**Frontend:**
- Use React DevTools Profiler to find slow renders
- Memoize expensive computations (React.memo)
- Use lazy loading for large components
- Check Network tab for large bundle sizes

## Documentation

When adding new features:

1. **Add comments to complex code**
   ```javascript
   // Convert Base64 audio to binary format for Deepgram API
   const binaryAudio = Buffer.from(base64Audio, 'base64');
   ```

2. **Update README.md if API changes**
   - Add new endpoints to API table
   - Update setup instructions if needed

3. **Add to ARCHITECTURE.md if major change**
   - New external API integration
   - New database tables
   - Architectural decisions

## Troubleshooting Development Issues

### Backend won't start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Try different port
PORT=3001 npm run dev
```

### Frontend build fails
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### API keys not working
```bash
# Verify .env exists and has correct keys
cat .env | grep API_KEY

# Check for whitespace around =
# Keys should look like: KEY=value (no spaces)
```

### Port already in use
```bash
# Find and kill process on port
lsof -i :3000
kill -9 <PID>
```

## Need Help?

- Check `.planning/STATE.md` for project decisions
- See `ARCHITECTURE.md` for design explanations
- Review existing code for patterns
- Check error messages carefully

## Questions?

Open an issue or contact the project owner.
