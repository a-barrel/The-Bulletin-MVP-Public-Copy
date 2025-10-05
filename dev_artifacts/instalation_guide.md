# Project Setup Guides

This document provides two setup guides:
1.  A guide for the initial project owner to set up the project from scratch.
2.  A guide for new developers to get the project running after the initial setup has been done.

---

## Guide for Initial Project Setup

These are the steps for the person doing the initial setup of the project.

1.  **Clone the Repository:**
    Open PowerShell and run:
    ```powershell
    git clone <repository_url>
    cd <project_directory>
    ```

2.  **Install Firebase CLI:**
    ```powershell
    npm install -g firebase-tools
    ```

3.  **Log in to Firebase:**
    This will open a browser window for you to log in.
    ```powershell
    firebase login
    ```

4.  **Initialize Firebase:**
    This will create the `firebase.json` and `.firebaserc` files.
    ```powershell
    firebase init
    ```
    Follow the interactive prompts:
    *   **Feature:** Emulators
    *   **Project:** Use an existing project
    *   **Emulators:** Authentication
    *   **Ports:** Use defaults
    *   **Download now:** Yes

5.  **Install Project Dependencies:**
    ```powershell
    npm run install:all
    ```

6.  **Create and Configure `.env` Files:**
    *   Create a `.env` file in the `client` directory and another one in the `server` directory.
    *   Copy the templates from the `README.md` into these files.
    *   Fill in all the required values, including the `VITE_FIREBASE_CONFIG` JSON from the Firebase console.

7.  **Run the Development Environment:**
    This will start the frontend, backend, and Firebase emulator.
    ```powershell
    npm run dev
    ```

8.  **Commit the Firebase Config Files:**
    This is the crucial step that will make setup easier for everyone else.
    ```powershell
    git add firebase.json .firebaserc
    git commit -m "feat: Add Firebase configuration"
    git push
    ```

---

## Guide for New Developers

This is the guide for new developers joining the project after the initial setup is complete.

1.  **Prerequisites:**
    *   Node.js and npm
    *   Firebase CLI (`npm install -g firebase-tools`)

2.  **Clone the Repository:**
    ```powershell
    git clone <repository_url>
    cd <project_directory>
    ```

3.  **Install Project Dependencies:**
    ```powershell
    npm run install:all
    ```

4.  **Create and Configure `.env` Files:**
    *   Create `.env` files in the `client` and `server` directories.
    *   Copy the templates from the `README.md`.
    *   Ask the project owner for the values to put in these files.

5.  **Run the Development Environment:**
    ```powershell
    npm run dev
    ```
