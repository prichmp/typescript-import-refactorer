

export default class Logger 
{

    public static verbose: boolean = false;

    public static debug(message: any)
    {
        if(Logger.verbose)
        {
            console.log(message)
        }        
    }

    public static log(message: any)
    {
        console.log(message)
    }
}