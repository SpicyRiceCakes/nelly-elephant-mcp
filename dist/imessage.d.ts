export declare function sendIMessage(text: string, handle: string): Promise<string>;
export declare function searchIMessages(options: {
    query?: string;
    handle?: string;
    limit?: number;
    daysBack?: number;
}): Promise<IMessageResult[]>;
export declare function listIMessageConversations(limit?: number): Promise<IMessageConversation[]>;
export interface IMessageResult {
    rowId: number;
    text: string;
    isFromMe: boolean;
    date: string;
    handle: string;
}
export interface IMessageConversation {
    handle: string;
    lastDate: string;
    messageCount: number;
}
//# sourceMappingURL=imessage.d.ts.map