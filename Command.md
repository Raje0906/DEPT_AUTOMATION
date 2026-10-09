# ==========================================
# 🚀 TEAM FEATURE WORKFLOW (ALL-IN-ONE)
# ==========================================

# 1. Update your local main branch first
git checkout main
git pull origin main

# 2. Create and switch to your feature branch
# (Replace 'feature-name' with what you are building, e.g. student-dashboard)
git checkout -b feature/feature-name

# ------------------------------------------
# 💻 DO YOUR CODING WORK HERE
# ------------------------------------------

# 3. Stage and save your changes
git add .
git commit -m "feat: describe what you built"

# 4. Push your branch to GitHub
git push -u origin feature/feature-name

# ------------------------------------------
# 🌐 GO TO GITHUB IN BROWSER:
# Click "Compare & pull request" -> "Create pull request"
# After teammate reviews & merges PR into main:
# ------------------------------------------

# 5. Switch back to main and update your local copy
git checkout main
git pull origin main

# 6. (Optional) Delete the finished local branch
git branch -d feature/feature-name





always follow this new method ........................PR method more easy than stash.........I can maintain the records easily