import express from 'express'
import cors from 'cors'
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';

dotenv.config()
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
 .then(() => db = mongoClient.db())
 .catch((err) => console.log(err.message));

const app = express();
app.use(cors());
app.use(express.json())

app.post('/participants', async (req, res)=>{
    const {name} = req.body;
    const message = {from: name, to: 'Todos', text: 'Entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss")}
    const userSchema = joi.string().required()
    const validation = userSchema.validate(name);

    if(validation.error) return res.sendStatus(422)
    try{
        const userExists = await db.collection("participants").findOne({name: name});
        if (userExists) return res.sendStatus(409)
        await db.collection("participants").insertOne({name, lastStatus: Date.now()})
        res.sendStatus(201) 
        
    } catch{
        res.sendStatus(400)
    }
})

app.get('/participants', async (req, res)=> {
    const names = []
    try{
        const participants = await db.collection("participants").find().toArray()
        participants.forEach(x => names.push(x.name))
        res.send(participants)
    } catch{
        res.sendStatus(400)
    }
})

app.post('/messages', async (req, res) =>{
    const {to, text, type} = req.body
    const {user} = req.headers
    const messageSchema = joi.object({
        from: joi.string().required(),
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.required(),
        time: joi.required()
    })
    if (!user) return res.sendStatus(422)
    const message = {from: user, to, text, type, time: dayjs().format("HH:mm:ss")}
    const validation = messageSchema.validate(message)
    const participant = await db.collection("participants").findOne({name: user})
    try{
        if (!participant) return res.sendStatus(401)
        if (validation.error || (type !== "message" && type !== "private_message")) return res.status(422).send(validation.error)
        
        await db.collection("messages").insertOne(message)
        res.sendStatus(201)
        console.log(message)
    }catch{
        res.sendStatus(400)
    }
})

app.get('/messages', async (req, res) =>{
    const {user} = req.headers
    const {limit} = req.query
    const relatedSchema = joi.object({
        user: joi.string().required(),
        limit: joi.number().integer().min(1).optional()
    })
    if(relatedSchema.validate({user, limit}).error) return res.sendStatus(422)
    let showedUp = []
    try{
        const relatedMessages = await db.collection("messages").find({$or:[{from: user}, {to: user}, {to: "Todos"}, {type: "message"}]}).toArray()        
            limit ? showedUp = relatedMessages.slice(-limit) : showedUp = relatedMessages
            res.send(showedUp)
        }

    catch{
        res.sendStatus(400)
    }
    
})

app.post('/status', async (req, res) => {
    const {user} = req.headers;
    if (!user) return res.sendStatus(404)
    try{
        const participant = await db.collection("participants").findOne({name: user})
        if (!participant) return res.sendStatus(404)
        await db.collection("participants").updateOne({name: user}, {$set:{lastStatus: Date.now()}})
        console.log(`User ${user} teve seu status atualizado`)
        res.sendStatus(200)
    } catch{
     res.sendStatus(400)   
    }
})

setInterval(async ()=>{
    const tenSecAgo = Date.now()-10000
    console.log(tenSecAgo)
    try{
    const willBeDeleted = await db.collection("participants").find({lastStatus: { $lt:tenSecAgo }}).toArray()
    await db.collection("participants").deleteMany({lastStatus: { $lt:tenSecAgo }})
    console.log(willBeDeleted)

    willBeDeleted.forEach(async (x) =>{ 
        const message = {from: x.name, to: 'Todos', text: 'Sai da sala...', type: 'status', time: dayjs().format("HH:mm:ss")}
        await db.collection("messages").insertOne(message)
    })}
    catch{
        console.log('Deu ruim')
    }
},15000)


const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))