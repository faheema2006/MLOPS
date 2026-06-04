"""
YOLO Model Inference Script
This script performs object detection using YOLOv8 model
"""

import os
import sys
from pathlib import Path
from ultralytics import YOLO
import cv2
import argparse
import json
from datetime import datetime


class YOLOInference:
    """Handles YOLO model inference and predictions"""
    
    def __init__(self, model_path='yolov8n.pt', confidence=0.4):
        """
        Initialize YOLO model
        
        Args:
            model_path: Path to the YOLO model
            confidence: Confidence threshold for detections
        """
        self.model = YOLO(model_path)
        self.confidence = confidence
        self.results_dir = Path('/app/outputs')
        self.results_dir.mkdir(exist_ok=True)
        
    def predict_image(self, image_path, save=True):
        """
        Perform inference on a single image
        
        Args:
            image_path: Path to the input image
            save: Whether to save results
            
        Returns:
            Dictionary with predictions and metadata
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        # Run prediction
        results = self.model(image_path, conf=self.confidence)
        
        # Extract predictions
        predictions = self._extract_predictions(results[0])
        
        # Save annotated image if requested
        if save and results[0].boxes.data.shape[0] > 0:
            output_path = self.results_dir / f"pred_{Path(image_path).stem}.jpg"
            annotated_frame = results[0].plot()
            cv2.imwrite(str(output_path), annotated_frame)
            predictions['output_image'] = str(output_path)
        
        predictions['timestamp'] = datetime.now().isoformat()
        return predictions
    
    def predict_batch(self, image_dir, save=True):
        """
        Perform inference on multiple images
        
        Args:
            image_dir: Directory containing images
            save: Whether to save results
            
        Returns:
            List of predictions for each image
        """
        image_paths = list(Path(image_dir).glob('*.jpg')) + list(Path(image_dir).glob('*.png'))
        all_predictions = []
        
        for img_path in image_paths:
            try:
                pred = self.predict_image(str(img_path), save=save)
                all_predictions.append(pred)
                print(f"✓ Processed: {img_path.name}")
            except Exception as e:
                print(f"✗ Error processing {img_path.name}: {str(e)}")
        
        return all_predictions
    
    def predict_video(self, video_path, save=True, save_frames=False):
        """
        Perform inference on video file
        
        Args:
            video_path: Path to input video
            save: Whether to save annotated video
            save_frames: Whether to save individual frames
            
        Returns:
            Dictionary with video processing results
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")
        
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        output_path = self.results_dir / f"pred_{Path(video_path).stem}.mp4"
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))
        
        frame_count = 0
        detections_per_frame = []
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            results = self.model(frame, conf=self.confidence)
            
            if results[0].boxes:
                predictions = self._extract_predictions(results[0])
                detections_per_frame.append({
                    'frame': frame_count,
                    'detections': len(predictions['boxes']),
                    'classes': predictions['classes']
                })
            
            annotated_frame = results[0].plot()
            out.write(annotated_frame)
            
            if save_frames and results[0].boxes:
                frame_path = self.results_dir / f"frame_{frame_count:04d}.jpg"
                cv2.imwrite(str(frame_path), annotated_frame)
        
        cap.release()
        out.release()
        
        return {
            'output_video': str(output_path),
            'total_frames': frame_count,
            'detections': detections_per_frame,
            'timestamp': datetime.now().isoformat()
        }
    
    def _extract_predictions(self, result):
        """Extract predictions from YOLO result object"""
        boxes = result.boxes
        predictions = {
            'boxes': [],
            'confidences': [],
            'classes': [],
            'class_names': []
        }
        
        if boxes:
            for box in boxes:
                coords = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0].cpu().numpy())
                cls = int(box.cls[0].cpu().numpy())
                cls_name = self.model.names[cls]
                
                predictions['boxes'].append({
                    'x1': float(coords[0]),
                    'y1': float(coords[1]),
                    'x2': float(coords[2]),
                    'y2': float(coords[3])
                })
                predictions['confidences'].append(conf)
                predictions['classes'].append(cls)
                predictions['class_names'].append(cls_name)
        
        return predictions


def main():
    parser = argparse.ArgumentParser(description='YOLO Model Inference')
    parser.add_argument('--image', type=str, help='Path to input image')
    parser.add_argument('--video', type=str, help='Path to input video')
    parser.add_argument('--dir', type=str, help='Path to image directory')
    parser.add_argument('--model', type=str, default='yolov8n.pt', help='Model path')
    parser.add_argument('--confidence', type=float, default=0.4, help='Confidence threshold')
    parser.add_argument('--no-save', action='store_true', help='Do not save results')
    
    args = parser.parse_args()
    
    # Initialize inference engine
    inference = YOLOInference(model_path=args.model, confidence=args.confidence)
    
    # Process based on input type
    if args.image:
        print(f"Processing image: {args.image}")
        result = inference.predict_image(args.image, save=not args.no_save)
        print(json.dumps(result, indent=2, default=str))
        
    elif args.video:
        print(f"Processing video: {args.video}")
        result = inference.predict_video(args.video, save=not args.no_save)
        print(json.dumps(result, indent=2, default=str))
        
    elif args.dir:
        print(f"Processing image directory: {args.dir}")
        results = inference.predict_batch(args.dir, save=not args.no_save)
        print(json.dumps(results, indent=2, default=str))
        
    else:
        print("No input specified. Use --image, --video, or --dir")
        parser.print_help()


if __name__ == '__main__':
    main()
