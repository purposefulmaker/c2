import { GalleryType } from "../types/GalleryTypes";

export interface UniverseOption {
    id: number;
    type: GalleryType;
    url: string;
    title: string;
    trackUrl: string;
  }
  
  export const universeOptions: UniverseOption[] = [
    {
        id: 1, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1738993676/AdobeStock_468271494_jv76ov.jpg', title: 'Nuremberg', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
    {
        id: 2, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1738993251/AdobeStock_1150834487_resvvr.jpg', title: 'Alaska', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
    {
        id: 3, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739703878/AdobeStock_939487292_kynmpy.jpg', title: 'Africa', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
    {
        id: 4, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1738993257/AdobeStock_1075108615_a0zlrf.jpg', title: 'Mt Rushmore', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
    {
        id: 5, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1738993258/AdobeStock_955311200_aqesaw.jpg', title: 'The Heavens 1', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
    {
        id: 6, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1738993515/AdobeStock_548199331_myzvqj.jpg', title: 'The Heavens 2', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
    {
        id: 7, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1738993257/AdobeStock_956034672_cpjoqs.jpg', title: 'The Heavens 3', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
    {
        id: 8, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1738993251/AdobeStock_1150834487_resvvr.jpg', title: 'The Heavens 4', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
    {
        id: 9, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/v1739703082/AdobeStock_947393903_bpr2lq.jpg', title: 'The Heavens 5', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
    {
        id: 10, url: 'https://res.cloudinary.com/dwds1pb4q/image/upload/w_1000,ar_16:9,c_fill,g_auto,e_sharpen/v1739121218/IMG_8858_g2vvag.png', title: 'Bentlyverse', trackUrl: 'https://res.cloudinary.com/dwds1pb4q/video/upload/v1739037275/2025-02-08_11-42-16_yt6uoh.mp3',
        type: "particle"
    },
];