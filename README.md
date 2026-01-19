# Secure Chat App (Socket.IO + Supabase + TweetNaCl)
A secure, end-to-end encrypted chat application built with Node.js, Socket.IO, and Supabase Authentication.

## Features
- **End-to-End Encryption**: Messages are encrypted using TweetNaCl (Curve25519) before leaving the client. The server never sees the raw message content.
- **Supabase Auth**: Secure Email/Password authentication.
- **Real-time Messaging**: Built with Socket.IO for instant communication.
- **Modern UI**: Clean, responsive interface with a dark theme.

## Prerequisites
- Node.js (v14 or later)
- NPM

## Installation

1.  Clone the repository or download the files.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Ensure local libraries are available:
    The app uses local copies of `tweetnacl` and `tweetnacl-util`. These are located in `public/libs`.
    If they are missing, run:
    ```bash
    # (PowerShell)
    mkdir public\libs
    cp node_modules\tweetnacl\nacl.min.js public\libs\nacl.min.js
    cp node_modules\tweetnacl-util\nacl-util.min.js public\libs\nacl-util.min.js
    ```

## Running Locally

Start the server:
```bash
node main.js
```
The application will be available at `http://localhost:3000`.

## Deployment

To deploy this application to a hosting provider (like Render, Railway, or Heroku):

1.  **Environment Variables**:
    -   Ensure `PORT` is set by the host (the app defaults to 3000).
    -   (Optional) Move Supabase keys to environment variables if you want to dynamic inject them, though for client-side keys, they are safe to be public.

2.  **Start Command**:
    -   `node main.js`

3.  **Build Step**:
    -   `npm install`
    -   (If usage of local copies of libs is required in build pipeline, ensure they are committed to git or copied during build).
    -   *Recommendation*: Commit the `public/libs` folder to your git repository so they are always available.

## Troubleshooting

-   **"Critical Error: Security libraries failed to load"**: Ensure `public/libs/nacl.min.js` exists and is accessible.
-   **Supabase Errors**: Check the console for detailed error messages. Ensure your Supabase project is active.
