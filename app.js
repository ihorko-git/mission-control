'use strict';

const fs = require('fs');
const parse = require('csv-parse');
const stringify = require('csv-stringify')
const http = require('http');
const https = require('https');
const sleep = require('sleep');

let inputFilePath = './data/purus.no.csv';
let outputFilePath = './data/output.csv';
let processedFilePath = './data/processed.csv';
let errorFilePath = './data/error.csv';
let tempFilePath = './data/temp.csv';

let links=[];
let domain = 'no.purus.bls.master-7rqtwti-mxzk4kfu3ev2s.eu-4.platformsh.site';
let oldSite = 'https://www.purus.no';

let outputStream = fs.createWriteStream(outputFilePath, {flags:'w'});
let temp = fs.readFileSync(tempFilePath,
    {encoding:'utf8', flag:'r'})
    .split('\n');

fs.createReadStream(inputFilePath)
    .pipe(parse({delimiter: '\t'}))
    .on('data', function(csvrow) {
        let link = csvrow.find(el => el !== undefined);
        if (link && link.indexOf(oldSite) != -1) {
            links.push(link);
        }

        // let path = csvrow[0].substring(oldSite.length);
        // if (path && temp.indexOf(path) != -1) {
        //     csvrow[2] = path;
        // }
        // outputStream.write(csvrow.join('\t') + "\n");

    })
    .on('end',function() {
        let len = links.length;
        let counter = 0;
        let redirects = [];

        let processed = fs.readFileSync(processedFilePath,
            {encoding:'utf8', flag:'r'})
            .split('\n');

        let processedStream = fs.createWriteStream(processedFilePath, {flags:'a'});
        let errorStream = fs.createWriteStream(errorFilePath, {flags:'w'});
        let tempStream = fs.createWriteStream(tempFilePath, {flags:'a'});
        let outputStream = fs.createWriteStream(outputFilePath, {flags:'a'});

        for (let i = 0; i < len; i++) {
            let path = links[i].substring(oldSite.length);
            if (i%100 == 0) {
                sleep.sleep(1);
            }

            if (processed.indexOf(path) != -1) {
                counter++;
                save();

                continue;
            }

            let options = {
                host: domain,
                path: path,
                port: 443,
                timeout: 30000,
                headers: {
                    'Connection':'keep-alive'
                }
            };
            console.log(`request ${options.path}`);

            let req = https.request(options, (res) => {
                console.log(`response ${options.path} - ${counter}`);
                if (res.statusCode == 404) {
                    redirects.push(req.path);
                    tempStream.write(options.path + "\n");
                }
                outputStream.write(options.path + '\t' + res.statusCode + "\n");
                if (res.statusCode == 404 || res.statusCode == 200)
                    processedStream.write(options.path + "\n");
                res.destroy();

                counter++;
                save();
            });

            req.on('error', (e) => {
                console.error(`problem with request[${req.path}]: ${e.message}`);
                errorStream.write(options.path + "\n");

                counter++;
                save();
            });
            req.end();
        }

        // processedStream.end();

        function save(){
            if (counter != len)
                return;
            redirects.sort();

            // fs.writeFile(outputFilePath, redirects.map( JSON.stringify ).join('\n'), () => console.log('redirects:', redirects));
            // fs.writeFile(outputFilePath, errors.map( JSON.stringify ).join('\n'), () => console.log('errors:', errors));

        }
    });


