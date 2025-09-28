# Requirements
Please install all the requirements using the links provided and following the instructions for your operating system. If the installer asks to add the program to PATH, check yes.

Node.js: https://nodejs.org/en/download  
git: https://git-scm.com/downloads  
Use the .msi for installing on Windows, .zip for MacOS  
Mongo Compass Windows: https://www.mongodb.com/try/download/compass  
mongosh: https://www.mongodb.com/try/download/shell 
# Verify installation using Powershell or Terminal and running:

```
git -v
node -v
npm -v
mongosh --version
```
# Using Git

Please make sure that git is properly setup on your machine. If you haven't finished the git tutorial, it is imperative that you do to be able to submit your work.

https://www.w3schools.com/git/

# Getting Started

Open up a terminal of your choice. Use Powershell on Windows or Terminal on MacOS. For the instructions for `cd` below, if on Windows, use the one that looks like `cd "$HOME/Documents...`, if on MacOS, use the command that looks like `~/Documents/...`
### Windows Instructions
```
mkdir "$HOME/Documents/CECS 491B/"; cd "$HOME/Documents/CECS 491B/"
git clone git@github.com:a-barrel/Pinpoint.git
cd Pinpoint
git pull origin
npm run install:all
npm run dev
```
### MacOS Instructions
```
mkdir ~/Documents/CECS\ 491B/ && cd ~/Documents/CECS\ 491B/
git clone git@github.com:a-barrel/Pinpoint.git
cd Pinpoint
npm run install:all
npm run dev
```

To run the website locally, use `npm run dev` in the main directory. Now that the server is running, you can make changes to files and see in real-time how they will display for users.

## General Workflow

Here is the general workflow of making changes to the repository. When you start working, cd to the Pinpoint directory. Pull changes from main, then start the server. Make changes in the client and server folder depending on what you're doing.

```
//In terminal 1 (Running the server)
cd "$HOME/Documents/CECS 491B/Pinpoint/" //Windows
cd ~/Documents/CECS\ 491B/Pinpoint //MacOS
npm run install:all
npm run dev
```

```
//In terminal 2 (Managing git instance)
cd "$HOME/Documents/CECS 491B/Pinpoint/" //Windows
cd ~/Documents/CECS\ 491B/Pinpoint/ //MacOS
git branch //List all branches
git switch (feature,bugfix,etc.)/branch-description //Switch to branch that exists
git checkout -b (feature,bugfix,etc.)/your-feature-here //Change to branch that doesn't exist yet

//Now, do all the changes to files in your favorite text editor / IDE for your feature 

git add -A //Adds all the files you have changed
git commit -m "Put a message here describing what your changes are and what they do."
git pull //Sync your local repo so it matches main
git push origin feature/your-feature-here
```
To see how your changes are reflected, `npm run dev` will automatically keep the website hosted at `localhost:5173` updated to whatever changes you make. Use your browser to check your changes. Make commits often and put **useful** messages that describe what you changed! 

## How to stop working on the project
When you're done working, make sure to push your changes to the branch you're in. Only push to main when your feature is done and someone else has looked over your changes.
```
git status //Verify you're in a branch that is not main
git add -A //Adds all the files you have changed
git commit -m "Put a message here describing what your changes are and what they do."
git pull //Sync your local repo so it matches main
git push origin feature/your-feature-here
```

## Critical ending step
Now, to stop the server go to the terminal that is running npm and hit `Ctrl+c` to stop the server. This is exteremly important. If you stop the server using `Ctrl+z` or simply closing the terminal, it can lead to the process still running or other undefined behavior. This is the cleanest way to stop working.