--- Installation ---

1) Node.js
Download and install Node.js (https://nodejs.org/en/).

2) Get Auth Token
The token is necessary to control the bot and is not included by default.
Ask the person responsible for the bot to give you the token.
Enter the token within the quotation marks and rename the file to auth.json

3) Install Packages
You will need to install packages in order for the bot to run properly.
Navigate to the bot folder and open a command line interface and enter the following commands:
npm install discord.io winston –save
npm install https://github.com/woor/discord.io/tarball/gateway_v6

4) Run
Start the program by right-clicking the run.ps1 file and selecting "Run with PowerShell" or open PowerShell and type "node bot.js".