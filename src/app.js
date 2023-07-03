import express from 'express'
import cors from 'cors'
import dayjs from 'dayjs';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import { stripHtml } from 'string-strip-html';

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
    const name = stripHtml(req.body.name).result
    const message = {from: name.trim(), to: 'Todos', text: 'Entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss")}
    const userSchema = joi.string().required()
    const validation = userSchema.validate(name);

    
    try{
        if(validation.error) return res.sendStatus(422)
        const userExists = await db.collection("participants").findOne({name: name});
        if (userExists) return res.sendStatus(409)
        await db.collection("participants").insertOne({name, lastStatus: Date.now()})
        await db.collection("messages").insertOne(message)
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
    const to = stripHtml(req.body.to).result
    const text = stripHtml(req.body.text).result
    const type = stripHtml(req.body.type).result
    const user = stripHtml(req.headers.user).result
    const messageSchema = joi.object({
        from: joi.string().required(),
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required(),
        time: joi.required()
    })
   
    try{
        if (!user) return res.sendStatus(422)
        const message = {from: user.trim(), to: to.trim(), text: text.trim(), type: type.trim(), time: dayjs().format("HH:mm:ss")}
        const validation = messageSchema.validate(message)
        const participant = await db.collection("participants").findOne({name: user})
        if (!participant) return res.sendStatus(422)
        if (validation.error) return res.sendStatus(422)
        
        await db.collection("messages").insertOne(message)
        res.sendStatus(201)
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
   
    try{
        if (!user) return res.sendStatus(404)
        const participant = await db.collection("participants").findOne({name: user})
        if (!participant) return res.sendStatus(404)
        await db.collection("participants").updateOne({name: user}, {$set:{lastStatus: Date.now()}})
        res.sendStatus(200)
    } catch{
     res.sendStatus(400)   
    }
})

app.delete('/messages/:id', async (req, res) => {
    const {id} = req.params;
    const {user} = req.headers;
    try{
        const message = await db.collection("messages").findOne({_id: new ObjectId(id)})
        if (!message) return res.sendStatus(404)

        if (message.from !== user) return res.sendStatus(401)

        await db.collection("messages").deleteOne({_id: new ObjectId(id)})
        res.sendStatus(200)
    }
    catch{
        res.sendStatus(400)
    }
})

app.put('/messages/:id', async (req, res) => {
    const {id} = req.params;
    const {user} = req.headers;
    const {to, text, type} = req.body
    const updateMessageSchema = joi.object({
        to: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required(),
        text: joi.required()
    })

    try{
        const participant = await db.collection("participants").findOne({name: user})
        const validation = updateMessageSchema.validate({to: to, type: type, text: text})
        if (!participant || validation.error) return res.sendStatus(422)
    
        const message = await db.collection("messages").findOne({_id: new ObjectId(id)})
        if (!message) return res.sendStatus(404)

        if (message.from !== user) return res.sendStatus(401)

        await db.collection("messages").updateOne({_id: new ObjectId(id)}, {$set: {to, type, text}})
        res.sendStatus(200)
    }
    catch{
        res.sendStatus(400)
    }
})

setInterval(async ()=>{
    const tenSecAgo = Date.now()-10000

    try{
    const willBeDeleted = await db.collection("participants").find({lastStatus: { $lt:tenSecAgo }}).toArray()
    await db.collection("participants").deleteMany({lastStatus: { $lt:tenSecAgo }})

    willBeDeleted.forEach(async (x) =>{ 
        const message = {from: x.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs().format("HH:mm:ss")}
        await db.collection("messages").insertOne(message)

    })}
    catch{
        res.sendStatus(400)
    }
},15000)


const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))