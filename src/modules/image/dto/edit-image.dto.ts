import { IsNotEmpty, IsString } from "class-validator";

export class EditImageDto{
    @IsString()
    @IsNotEmpty()
    s3_url:string

   
}