# Instagram Automation Dashboard

This project is a professional, modular Instagram automation dashboard built with Node.js, Express, and EJS. It allows users to manage multiple Instagram accounts, view profile data, and automate interactions with posts based on hashtags.

## Features

-   **Multi-Account Management:** Add and switch between multiple Instagram accounts.
-   **Profile Data Display:** View key profile statistics like followers, following, and post count.
-   **Hashtag-Based Automation:** Automatically like comments on posts related to specific hashtags.
-   **Randomized Actions:** Uses random delays between actions to avoid Instagram restrictions.
-   **Live Status Updates:** A real-time status panel shows the bot's current activity.
-   **Mobile-First Design:** The UI is designed to resemble the Instagram mobile app.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/instagram-automation-dashboard.git
    cd instagram-automation-dashboard
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Running the Application

To start the application, run the following command:

```bash
npm start
```

The application will be available at `http://localhost:3000`.

*Note: You'll need to add a `start` script to your `package.json` file:*

```json
"scripts": {
  "start": "node index.js",
  "test": "jest"
}
```

## Usage

1.  **Add an Account:** When you first open the application, you'll be prompted to add an Instagram account. Enter your username and password to log in.
2.  **View Dashboard:** Once you've added an account, you'll see the main dashboard, which displays your profile information.
3.  **Switch Accounts:** If you have multiple accounts, you can switch between them using the dropdown menu.
4.  **Start Automation:** Enter a hashtag in the input field and click "Start Liking" to begin the automation process. The status panel will show the bot's activity in real time.

## Running Tests

To run the automated tests, use the following command:

```bash
npm test
```
