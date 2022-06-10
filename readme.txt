--- Installation ---

!) Token required
Ask the person responsible to give you the token.
With the token, create a new file in the main folder called auth.json with the following lines:

{

"token": "TOKEN HERE"

}

Replace TOKEN HERE with the token (within the quotation marks).

1) Node.js
Download and install Node.js (https://nodejs.org/en/).

2) Install Packages
You will need to install packages in order for the bot to run properly.
Navigate to the bot folder and open a command line interface and enter the following commands:
npm install discord.io winston –save
npm install https://github.com/woor/discord.io/tarball/gateway_v6

3) Run
Start the program by right-clicking the run.ps1 file and selecting "Run with PowerShell".
Alternative, open PowerShell and type "node bot.js".