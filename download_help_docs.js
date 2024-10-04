const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Get the input URL from the command line arguments
const inputUrl = process.argv[2];
if (!inputUrl) {
    console.error('Please provide a URL as a command line argument.');
    process.exit(1);
}

(async () => {
    // Launch a browser instance
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Log console messages from the browser to Node.js
    //page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // List of URLs to navigate (start with the input URL)
    const urlsToNavigate = [];

    // Navigate to the input URL
    await page.goto(inputUrl, { waitUntil: 'networkidle' });

    // Wait for the '.slds-tree__item > button' elements to be present and visible
    await page.waitForSelector('.slds-tree__item > button:not([disabled])', { visible: true, timeout: 3000 });

    /*
    // Expand the table of contents by clicking on all '.slds-tree__item > button' elements
    const expandButtons = await page.$$('.slds-tree__item > button:not([disabled])');
    for (const button of expandButtons) {
        await button.click();
        await page.waitForTimeout(500); // Small delay to ensure DOM updates
    }
    */

    // Prepare the list of URLs to further navigate by getting 'id' attributes from 'li[role="treeitem"]' elements
    const newUrls = await page.$$eval('li[role="treeitem"] a', elements =>
        elements.map(el => {
            const id = el.getAttribute('href').match(/\?id=([^&]+)&/)?.[1];
            console.log('page id:' + id);
            return id ? `https://help.salesforce.com/s/articleView?id=${id}&language=en_US&type=5` : null;
        }).filter(url => url !== null)
    );

    // Add the newly prepared URLs to the list of URLs to navigate
    urlsToNavigate.push(...newUrls);

    console.log('number of links to navigate: ' + urlsToNavigate.length);

    const parentUrlId = urlsToNavigate[0].match(/\?id=([^&]+)&/)?.[1];
    const folderPath = './' + parentUrlId;
    // Create the folder synchronously
    try {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath);
            console.log(`Directory created successfully at: ${folderPath}`);
        } else {
            console.log('Directory already exists.');
        }
    } catch (err) {
        console.error(`Error creating directory: ${err.message}`);
    }

    // Loop through the list of URLs and save the HTML of the 'div#content' element
    for (let i = 0; i < urlsToNavigate.length; i++) {
        const url = urlsToNavigate[i];
        const fileSuffix = url.match(/\?id=([^&]+)\.htm&/)?.[1];
        await page.goto(url, { waitUntil: 'networkidle' });

        // Extract the HTML content of the 'div#content' element
        const content = await page.$eval('div#content', el => el.outerHTML);

        // Save the content to a file with a sequential number prefix
        const filename = path.join(folderPath, `${String(i + 1).padStart(3, '0')}_${fileSuffix}.html`);
        fs.writeFileSync(filename, content);

        // console.log(`Saved content from ${url} to ${filename}`);
    }

    // Close the browser
    await browser.close();
})();

