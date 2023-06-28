import express from 'express'
import cors from 'cors'
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config()
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
 .then(() => db = mongoClient.db())
 .catch((err) => console.log(err.message));

const app = express();
app.use(cors());
app.use(express.json())

const participants = []
const messages = []

app.post('/participants', (req, res)=>{
    const {name} = req.body;
    const message = {from: name, to: 'Todos', text: 'Entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss")}
    
    if(name){
        db.collection("participants").findOne({name: name})
        .then(participant => {
            if(participant){
                res.sendStatus(409)
            }else{
                db.collection("participants").insertOne({name, lastStatus: Date.now()})
                .then(() => {
                    db.collection("messages").insertOne(message)
                    .then(() => {
                        res.status(201).send(message)
                    })
                    .catch(err => {
                        res.sendStatus(400)
                    })
                })
                .catch(err => {
                    res.sendStatus(400)
                })

            }
        })
        .catch(err => res.sendStatus(400))

    } else{
        res.sendStatus(422)
    }
    
})

app.get('/participants', (req, res)=> {
    const names = []

    db.collection("participants").find().toArray()
    .then(participants =>{
        participants.forEach(x => names.push(x.name))
        res.send(names)
    })
    .catch(() => {
        res.sendStatus(400)
    })

})

app.post('/messages', (req, res) =>{
    const {to, text, type} = req.body
    const {user} = req.headers

    if (user){
    db.collection("participants").findOne({name: user})
    .then(participant => {
        if (participant){
            if(to && text && (type === "message" || type === "private_message")){
            const message = {from: user, to, text, type, time: dayjs().format("HH:mm:ss")}
            
            db.collection("messages").insertOne(message)
            .then(()=>{
                res.sendStatus(201)
                console.log(message)
            })
            .catch(()=>{
                res.sendStatus(422)
            })
            
            } else{
                res.sendStatus(422)
            }
        } else{
            res.sendStatus(422)
        }
    })
    .catch(()=>{
        res.sendStatus(422)
    })
    } else{
        res.sendStatus(422)
    }   
})

app.get('/messages', (req, res) =>{
    const {user} = req.headers
    const {limit} = req.query

    if(user && (!limit || (Number.isInteger(parseFloat(limit)) && limit > 0))){
    db.collection("messages").find({$or:[{from: user}, {to: user}, {to: "Todos"}, {type: "message"}]}).toArray()
    .then(relatedMessages => {
        let showedUp = []
        limit ? showedUp = relatedMessages.slice(-limit) : showedUp = relatedMessages
        res.send(showedUp)
    })
    .catch(()=>{
        res.sendStatus(400)
    })
    } else{
       /* db.collection("messages").find().toArray()
        .then(relatedMessages => {
            res.send(relatedMessages)
        }) */
        res.sendStatus(422)
    }
})



const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))