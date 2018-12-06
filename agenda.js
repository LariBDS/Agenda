const Telegraf = require('telegraf')
const Extra = require ('telegraf/extra')
const Markup = require ('telegraf/markup')
const moment = require ('moment')

const session = require ('telegraf/session')
const Stage = require ('telegraf/stage')
const Scene = require ('telegraf/scenes/base')


const {
    getAgenda,
    getTarefa,
    getTarefas,
    getConcluidas,
    incluirTarefa,
    concluirTarefa,
    excluirTarefa,
    atualizarDataTarefa,
    atualizarObsTarefa,} = require('./agenda.Servicos')

const bot = new Telegraf ('649960004:AAHGpnZBAry7uy9XdXBOsIefMiqur-2dEQU')
bot.start(ctx =>{
    const nome = ctx.update.message.from.first_name
    ctx.reply(`Seja bem vindo, ${nome}! \nEscreva nova (nome da sua tarefa) , para adicionar a sua tarefa na agenda! Mais instruções em /help.`)    
})

const formatarData = data =>
    data ? moment(data).format('DD/MM/YYYY') : '' 

const exibirTarefa = async (ctx, tarefaId, novaMsg = false) => {
    const tarefa = await getTarefa(tarefaId)
    const conclusao = tarefa.dt_conclusao ?
        `\n<b>Concluída em:</b> ${formatarData(tarefa.dt_conclusao)}` : ''
    const msg = `  
        <b>${tarefa.descricao}</b>
        <b>Previsao:</b> ${formatarData(tarefa.dt_previsao)}${conclusao}
        <b>Observacoes:</b> ${tarefa.observacao || ''}
    `
    if (novaMsg){
        ctx.reply(msg, botoesTarefa(tarefaId))
    }else{
        ctx.editMessageText(msg, botoesTarefa(tarefaId))
    }
}


const botoesAgenda = tarefas => {
    const botoes = tarefas.map(item =>{
        const data = item.dt_previsao ?
        `${moment(item.dt_previsao).format('DD/MM/YYYY')} - ` : ''
        return[Markup.callbackButton(`${data}${item.descricao}`, `mostrar ${item.id}`)]
    })
    return Extra.markup(Markup.inlineKeyboard(botoes,{columns: 1}))
}
const botoesTarefa = idTarefa => Extra.HTML().markup(Markup.inlineKeyboard([
    Markup.callbackButton('✔️',`concluir ${idTarefa}`),
    Markup.callbackButton('📅',`setData ${idTarefa}`),
    Markup.callbackButton('💬',`addNota ${idTarefa}`),
    Markup.callbackButton('✖️',`excluir ${idTarefa}`),
],{columns: 4}))

//------ Comandos bot

bot.command('dia', async ctx =>{
    const tarefas = await getAgenda(moment())
    ctx.reply('Aqui está a sua agenda do dia !', botoesAgenda(tarefas))    
})
bot.command('amanha', async ctx => {
    const tarefas = await getAgenda(moment().add({day: 1}))
    ctx.reply('Aqui está a sua agenda de amanhã !', botoesAgenda(tarefas))
})
bot.command('semana', async ctx => {
    const tarefas = await getAgenda(moment().add({week:1}))
    ctx.reply('Aqui está agenda da semana !',botoesAgenda(tarefas))
})
bot.command('mes', async ctx =>{
    const tarefas = await getAgenda(moment().add({month: 1}))
    ctx.reply('Aqui está a sua agenda do mês !', botoesAgenda(tarefas))
})
bot.command('concluidas', async ctx => {
    const tarefas = await getConcluidas()
    ctx.reply('Estas são as tarefas que você já concluiu!', botoesAgenda(tarefas))
})
bot.command('tarefas', async ctx => {
    const tarefas = await getTarefas()
    ctx.reply('Estas são as tarefas sem data definida!', botoesAgenda(tarefas))
})
bot.command('todas', async ctx =>{
    const tarefas = await getAgenda(moment().add({month: 99}))
    ctx.reply('Aqui está a sua agenda !', botoesAgenda(tarefas))
})
bot.command('help',async ctx =>{
    ctx.reply("/dia - mostra todas as tarefas do dia de hoje.\n/amanha - mostra todas as tarefas do dia para amanhã\n/semana - mostra todas as tarefas da semana\n/mes - mostra todas as tarefas do mês\n/concluidas - mostra todas as tarefas concluidas\n/tarefas - mostra todas as tarefas sem data definida\n/todas - mostra todas as tarefas")
})

//------ Ações bot

bot.action(/mostrar (.+)/, async ctx =>{
    await exibirTarefa(ctx, ctx.match[1])
})
bot.action(/concluir (.+)/, async ctx => {
    await concluirTarefa(ctx.match[1])
    await exibirTarefa(ctx,ctx.match[1])
    await ctx.reply('tarefa concluída')
})
bot.action(/excluir (.+)/, async ctx => {
    await excluirTarefa(ctx.match[1])
    await ctx.editMessageText('Tarefa excluída')
})

const tecladoDatas = Markup.keyboard ([
    ['Hoje','Amanhã'],
    ['1 Semana','1 Mês'],
]).resize().oneTime().extra()

let idTarefa=null
//-----------Data Scene

const dataScene = new Scene('data')
dataScene.enter(ctx => {
    idTarefa = ctx.match[1]
ctx.reply('Gostaria de definir alguma data?', tecladoDatas)
})

dataScene.leave(ctx => idTarefa = null) 

dataScene.hears(/hoje/gi, async ctx =>{
    const data = moment()
    handleData(ctx, data)
})

dataScene.hears(/Amanh[ãa]/gi, async ctx =>{
    const data = moment().add({day: 1})
    handleData(ctx,data)
})

dataScene.hears(/^(\d+) dias?$/gi, async ctx =>{
    const data = moment().add({days: ctx.match[1]})
    handleData(ctx,data)
})

dataScene.hears(/^(\d+) semanas?$/gi, async ctx =>{
    const data = moment().add({weeks: ctx.match[1]})
    handleData(ctx, data)
})
dataScene.hears(/^(\d+) m[êe]s(es)?$/gi, async ctx =>{
    const data = moment().add({months: ctx.match[1]})
    handleData(ctx,data)
})
dataScene.hears(/(\d{2}\/\d{2}\/\d{4})/g, async ctx =>{
    const data = moment(ctx.match[1], 'DD/MM/YYYY')
    handleData(ctx,data)
})
const handleData = async (ctx, data) => {
    await atualizarDataTarefa(idTarefa, data)
    await ctx.reply(`Data atualizada com sucesso!!!`)
    await exibirTarefa(ctx, idTarefa, true)
    ctx.scene.leave()
}
dataScene.on('message', ctx => {
    ctx.reply('Padrões aceitos\ndd/MM/YYYY\nX dias\nX semanas\nX meses')
})
// ObservaçãoScene
const obsScene = new Scene('observacoes')

obsScene.enter(ctx =>{
    idTarefa = ctx.match[1]
    ctx.reply(`Já pode adicionar suas anotações...`)
})
obsScene.leave(ctx => idTarefa= null)

obsScene.on('text', async ctx =>{
    const tarefa = getTarefa(idTarefa)
    const novoTexto = ctx.update.message.text
    const obs = tarefa.observacao? 
        tarefa.observacao + '\n---\n' + novoTexto : novoTexto
    const res = await atualizarObsTarefa(idTarefa, obs)
    await ctx.reply('Observação atualizada')
    await exibirTarefa(ctx, idTarefa, true)
    ctx.scene.leave()
    })
    obsScene.on('message', ctx => ctx.reply(`Apenas texto será aceito`))


//---------Inserir Tarefa

bot.hears(/nova +[a-z]/gi, async ctx => {
    try{
        const tarefa = await incluirTarefa(ctx.update.message.text.slice(5.,ctx.update.message.text.length))
        await exibirTarefa(ctx,tarefa.id, true)

    }catch(err){    
        console.log(err)
    }
})

const stage = new Stage([dataScene, obsScene])
bot.use(session())
bot.use(stage.middleware())


bot.action(/setData (.+)/, Stage.enter('data'))
bot.action(/addNota (.+)/, Stage.enter('observacoes'))
bot.startPolling()