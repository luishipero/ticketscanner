// set up ======================================================================
var express = require('express');
const axios = require('axios');
var app = express(); 						// create our app w/ express
const env = process.env;
const hbs = require('express-handlebars');
const cheerio = require('cheerio')

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'

var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var path    = require('path');
var request = require('request');
var htmlparser = require('htmlparser2');




// configuration ===============================================================

app.use(express.static(path.join(__dirname, 'public'))); 		// set the static files location /public/img will be /img for users
app.use(morgan('dev')); // log every request to the console
app.use(bodyParser.urlencoded({'extended': 'true'})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(methodOverride('X-HTTP-Method-Override')); // override with the X-HTTP-Method-Override header in the request


// view engine setup
app.engine('hbs', hbs({extname: 'hbs', 
    defaultLayout: 'layout', 
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials/'}));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// api ---------------------------------------------------------------------
    app.get('/', function (req, res) {
        //res.sendFile(views + 'new.html');
        res.location('/tetas');
        res.render('index');
    });


    app.post('/', function (req, res) {
        callAllTicketSites(req, res);
    });
 

    function callAllTicketSites(req, res){
        let ticketSearch = req.body.ticket.split(' ').join('+');
        axios.all([blueTicket(ticketSearch), bilheteriaOnline(ticketSearch), ticketLine(ticketSearch)])
            .then(axios.spread(function (blueResp, bolResp, ticketLineResp) {
                let blueTicketArray = parseBlueTicket(blueResp);
                let bolTicketArray = parseBilOnline(bolResp);
                let ticketLineArray = parseTicketLine(ticketLineResp);

                if(0 === blueTicketArray.length && 0 === bolTicketArray.length && 0 === ticketLineArray.length){
                    res.render('index', {noResults: true, searchTerm: req.body.ticket});
                } else {
                    let allTickets = blueTicketArray.concat(bolTicketArray).concat(ticketLineArray);
                    res.render('index', {myArray: allTickets});
                }
        })).catch(error => {
            console.log(error);
        });;
    }

    function blueTicket(ticketSearch){
        return axios.get('https://www.blueticket.pt/API/Transversal/getSearchEvent?psTexto=' + ticketSearch);
    }

    function ticketLine(ticketSearch){
        return axios.get('https://ticketline.sapo.pt/pesquisa?query=' + ticketSearch);
    }

    function bilheteriaOnline(ticketSearch){
        return axios.get('https://www.bol.pt/Comprar/Pesquisa?&q=' + ticketSearch);
    }


    function parseBlueTicket(blueResp){
        let blueTicketArray = [];
        for(let i = 0; i < blueResp.data.EventosLista.length; i++){
            let allInfo = blueResp.data.EventosLista[i];
            allInfo.Url = 'https://www.blueticket.pt' + allInfo.Url + '/' + allInfo.Nome.split(' ').join('-');
            allInfo.DataExtenso = allInfo.Data.substring(0, 10);
            blueTicketArray.push(allInfo);
        }
        return blueTicketArray;
    }


    function parseTicketLine(ticketLineResp){
        let ticketArr = [];
        let $ = cheerio.load(ticketLineResp.data);
        if(1 === $('#eventos li.empty').length) {
            return ticketArr;
        } 
        let eventTickets = $('#eventos li');
        let ticketLineUrl = 'https://ticketline.sapo.pt';
        
        eventTickets.each(function(i, element){
            var data = $(element);
            
            let ticketVars = new Object();
            ticketVars.Url = ticketLineUrl + data.find('a').attr('href');
            ticketVars.ImagemLink = data.find('.thumb img').attr('data-src-original') + '&W=100';
            ticketVars.Nome = data.find('.details .title').html().toUpperCase();
            ticketVars.DataExtenso = data.find('.date').attr('data-date');
            ticketVars.Local = data.find('.details .venues').html().toUpperCase();
            ticketArr.push(ticketVars);
        });

        return ticketArr;
    }


    function parseBilOnline(bolResp){
        let $ = cheerio.load(bolResp.data);
        let eventTickets = $('#ResultadoPesquisa .item-montra.evento script');
        let ticketArr = [];

        
        
        eventTickets.each(function(i, element){
            var data = $(element); // it is equal to var = $(this);
            let temp;
            try{
                temp = JSON.parse(data.html());
            } catch(e) {
                console.log('BOL failed to deliver proper JSON \n', e);
                return;
            }

            /*let ticketVars = {
                Url: temp.url,
                ImagemLink: temp.image
            }*/
            //console.log(element.children[0].data);
            let ticketVars = new Object();
            ticketVars.Url = temp.url;
            ticketVars.ImagemLink = temp.image;
            ticketVars.Nome = temp.name;
            ticketVars.DataExtenso = temp.startDate.substring(0, 10);
            ticketVars.Local = temp.location.name.toUpperCase();
            ticketVars.Cidade = temp.location.address.addressLocality.toUpperCase();
            ticketArr.push(ticketVars);
        });

        return ticketArr;
    }
    

app.listen(server_port, server_ip_address, function () {
  console.log( 'Listening on ' + server_ip_address + ', port ' + server_port );
});